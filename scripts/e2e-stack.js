const { spawn, spawnSync } = require("node:child_process");
const net = require("node:net");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const dockerCmd =
  process.platform === "win32"
    ? path.join(process.env.ProgramFiles || "C:\\Program Files", "Docker", "Docker", "resources", "bin", "docker.exe")
    : "docker";
const composeProject = "gestao_financeira_e2e";
const postgresPort = Number(process.env.E2E_POSTGRES_PORT || 5433);
const apiPort = 3001;
const webPort = 3000;
const adminEmail = process.env.ADMIN_EMAIL || "fadomingosf@gmail.com";
const databaseName = process.env.E2E_POSTGRES_DB || "gestao_financeira_e2e";
const databaseUrl = `postgresql://postgres:postgres@127.0.0.1:${postgresPort}/${databaseName}?schema=public`;

let postgresStarted = false;
let apiProcess = null;
let webProcess = null;
let shuttingDown = false;

function resolvedDockerCmd() {
  if (process.platform !== "win32") {
    return dockerCmd;
  }

  if (require("node:fs").existsSync(dockerCmd)) {
    return dockerCmd;
  }

  return "docker";
}

function composeArgs(extra = []) {
  return [
    "compose",
    "-p",
    composeProject,
    "-f",
    "docker-compose.yml",
    "-f",
    "docker-compose.e2e.yml",
    ...extra
  ];
}

function runSync(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: "inherit",
    shell: false,
    ...options
  });

  if (result.status !== 0) {
    const label = [command, ...args].join(" ");
    throw new Error(`${label} failed with exit code ${result.status ?? "unknown"}`);
  }
}

function spawnProcess(command, args, env) {
  return spawn(command, args, {
    cwd: rootDir,
    stdio: "inherit",
    shell: false,
    env: {
      ...process.env,
      ...env
    }
  });
}

function killProcessTree(child) {
  if (!child || child.killed) {
    return;
  }

  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
      cwd: rootDir,
      stdio: "ignore",
      shell: false
    });
    return;
  }

  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    try {
      child.kill("SIGTERM");
    } catch {
      // Ignore cleanup failures.
    }
  }
}

function waitForPort(port, host, timeoutMs = 180000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.createConnection({ port, host }, () => {
        socket.end();
        resolve();
      });

      socket.on("error", () => {
        socket.destroy();
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error(`Timed out waiting for ${host}:${port}`));
          return;
        }
        setTimeout(attempt, 1000);
      });
    };

    attempt();
  });
}

async function startStack() {
  const activeDockerCmd = resolvedDockerCmd();
  const dockerCheck = spawnSync(activeDockerCmd, ["--version"], {
    cwd: rootDir,
    stdio: "ignore",
    shell: false
  });

  if (dockerCheck.status !== 0) {
    throw new Error(
      "Docker Desktop is required for e2e. Install and start Docker, then rerun the suite."
    );
  }

  runSync(activeDockerCmd, composeArgs(["up", "-d", "postgres"]), {
    env: {
      ...process.env,
      POSTGRES_USER: "postgres",
      POSTGRES_PASSWORD: "postgres",
      POSTGRES_DB: databaseName,
      E2E_POSTGRES_PORT: String(postgresPort)
    }
  });
  postgresStarted = true;

  await waitForPort(postgresPort, "127.0.0.1");

  const e2eEnv = {
    ...process.env,
    ADMIN_EMAIL: adminEmail,
    E2E_ADMIN_EMAIL: adminEmail,
    DATABASE_URL: databaseUrl,
    E2E_LOGIN_PASSWORD: process.env.E2E_LOGIN_PASSWORD || "secret123",
    E2E_WALLET_NAME: process.env.E2E_WALLET_NAME || "Familia Domingos",
    JWT_SECRET: process.env.JWT_SECRET || "e2e_access_secret",
    REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET || "e2e_refresh_secret",
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "15m",
    REFRESH_TOKEN_EXPIRES_IN: process.env.REFRESH_TOKEN_EXPIRES_IN || "7d",
    PORT: String(apiPort),
    NEXT_PUBLIC_API_URL: `http://127.0.0.1:${apiPort}`,
    NEXT_PUBLIC_ADMIN_EMAIL: adminEmail
  };

  runSync(npmCmd, ["-w", "apps/api", "run", "prisma:generate"], { env: e2eEnv });
  runSync(npmCmd, ["-w", "apps/api", "run", "prisma:migrate"], { env: e2eEnv });
  runSync(process.execPath, [path.join(rootDir, "scripts", "e2e-seed.js")], { env: e2eEnv });

  apiProcess = spawnProcess(npmCmd, ["run", "dev:api"], e2eEnv);
  apiProcess.on("exit", (code, signal) => {
    if (!shuttingDown && code !== 0 && signal !== "SIGTERM" && signal !== "SIGINT") {
      console.error(`API exited unexpectedly with code ${code} signal ${signal}`);
      void shutdown(1);
    }
  });

  await waitForPort(apiPort, "127.0.0.1");

  webProcess = spawnProcess(npmCmd, ["run", "dev:web"], e2eEnv);
  webProcess.on("exit", (code, signal) => {
    if (!shuttingDown && code !== 0 && signal !== "SIGTERM" && signal !== "SIGINT") {
      console.error(`Web exited unexpectedly with code ${code} signal ${signal}`);
      void shutdown(1);
    }
  });

  await waitForPort(webPort, "127.0.0.1");
}

async function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  if (webProcess) {
    killProcessTree(webProcess);
  }
  if (apiProcess) {
    killProcessTree(apiProcess);
  }

  if (postgresStarted) {
    runSync(resolvedDockerCmd(), composeArgs(["down", "-v"]), {
      env: {
        ...process.env,
        POSTGRES_USER: "postgres",
        POSTGRES_PASSWORD: "postgres",
        POSTGRES_DB: databaseName,
        E2E_POSTGRES_PORT: String(postgresPort)
      }
    });
  }

  process.exit(exitCode);
}

async function main() {
  const mode = process.argv[2] || "serve";

  if (mode === "down") {
    runSync(resolvedDockerCmd(), composeArgs(["down", "-v"]), {
      env: {
        ...process.env,
        POSTGRES_USER: "postgres",
        POSTGRES_PASSWORD: "postgres",
        POSTGRES_DB: databaseName,
        E2E_POSTGRES_PORT: String(postgresPort)
      }
    });
    return;
  }

  process.on("SIGINT", () => {
    void shutdown(0);
  });
  process.on("SIGTERM", () => {
    void shutdown(0);
  });

  await startStack();
  console.log(`E2E stack ready on http://127.0.0.1:${webPort}`);
}

main().catch(async (error) => {
  console.error(error);
  await shutdown(1).catch(() => null);
});
