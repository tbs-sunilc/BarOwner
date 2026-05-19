const signalR = require("@microsoft/signalr");

const apiBaseUrl = process.env.API_URL || "http://192.168.1.232:5000";
const barId = Number(process.argv[2] || process.env.BAR_ID || 1);

const staffToken = process.env.STAFF_TOKEN || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEwMDUsIm1vYmlsZSI6Iis5MTEyMzQ1Njc4OTAiLCJreWNfc3RhdHVzIjoiQXBwcm92ZWQiLCJqdGkiOiIyMTFiODllMzdhODg0Zjc5YTdmMjlmOThkZDljZTRlYiIsImlhdCI6MTc3OTE4NTg5MywiaHR0cDovL3NjaGVtYXMubWljcm9zb2Z0LmNvbS93cy8yMDA4LzA2L2lkZW50aXR5L2NsYWltcy9yb2xlIjoic3RhZmYiLCJuYmYiOjE3NzkxODU4OTMsImV4cCI6MTc3OTE4OTQ5MywiaXNzIjoiU2lwU2F2ZSIsImF1ZCI6IlNpcFNhdmUuQ2xpZW50cyJ9.sMehBMIzIitRTYofaMnO__pFHEKNhYyXKK-5E6TSORI";
const userToken = process.env.USER_TOKEN || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjIwMTksIm1vYmlsZSI6Ijk4Nzk4Nzk4NzAiLCJreWNfc3RhdHVzIjoiQXBwcm92ZWQiLCJqdGkiOiIxMDNiMGNhNTJhYTE0MmY1YWMyMTEzODYwNTFlODRmNyIsImlhdCI6MTc3OTE4NjExNywibmJmIjoxNzc5MTg2MTE3LCJleHAiOjE3NzkxODk3MTcsImlzcyI6IlNpcFNhdmUiLCJhdWQiOiJTaXBTYXZlLkNsaWVudHMifQ.5N0Kat8g38rRJAiwz_eSK0zTyjgZrYcYgZ4il-ikTVU";

async function main() {
  if (!staffToken && !userToken) {
    console.error("Set STAFF_TOKEN, USER_TOKEN, or both before running this script.");
    console.error("Example:");
    console.error('$env:STAFF_TOKEN="staff-jwt"; $env:USER_TOKEN="user-jwt"; node pourhub.js 1');
    process.exitCode = 1;
    return;
  }

  console.log(`Using API: ${apiBaseUrl}`);
  console.log(`Using barId: ${barId}`);

  const connections = [];

  if (staffToken) {
    connections.push(await startStaffConnection(staffToken));
  }

  if (userToken) {
    connections.push(await startUserConnection(userToken));
  }

  console.log("\nReady. Keep this terminal open.");
  console.log("Create a pour request as the user, then serve/cancel it as staff.");
  console.log("Press Ctrl+C to stop.");

  process.on("SIGINT", async () => {
    console.log("\nStopping SignalR connections...");
    await Promise.all(connections.map(c => c.stop().catch(() => undefined)));
    process.exit(0);
  });
}

async function startStaffConnection(token) {
  const claims = decodeJwtPayload(token);
  printToken("STAFF", claims);
  assertNotExpired("STAFF", claims);

  const connection = buildConnection(token);

  connection.on("NewPourRequest", data => {
    console.log("\n[STAFF] NewPourRequest:");
    console.dir(data, { depth: null, colors: true });
  });

  connection.on("PourConfirmed", data => {
    console.log("\n[STAFF] PourConfirmed:");
    console.dir(data, { depth: null, colors: true });
  });

  connection.on("PourCancelled", data => {
    console.log("\n[STAFF] PourCancelled:");
    console.dir(data, { depth: null, colors: true });
  });

  connection.onreconnecting(error => {
    console.log("[STAFF] Reconnecting...", error?.message || "");
  });

  connection.onreconnected(async () => {
    console.log("[STAFF] Reconnected");
    await joinBarGroup(connection);
  });

  connection.onclose(error => {
    console.log("[STAFF] Closed", error?.message || "");
  });

  await connection.start();
  console.log("[STAFF] Connected");
  await joinBarGroup(connection);
  return connection;
}

async function startUserConnection(token) {
  const claims = decodeJwtPayload(token);
  printToken("USER", claims);
  assertNotExpired("USER", claims);

  const connection = buildConnection(token);

  connection.on("PourConfirmed", data => {
    console.log("\n[USER] PourConfirmed:");
    console.dir(data, { depth: null, colors: true });
  });

  connection.on("PourCancelled", data => {
    console.log("\n[USER] PourCancelled:");
    console.dir(data, { depth: null, colors: true });
  });

  connection.on("NewPourRequest", data => {
    console.log("\n[USER] NewPourRequest:");
    console.dir(data, { depth: null, colors: true });
  });

  connection.onreconnecting(error => {
    console.log("[USER] Reconnecting...", error?.message || "");
  });

  connection.onreconnected(() => {
    console.log("[USER] Reconnected");
  });

  connection.onclose(error => {
    console.log("[USER] Closed", error?.message || "");
  });

  await connection.start();
  console.log("[USER] Connected. Listening on its automatic user group.");
  return connection;
}

function buildConnection(token) {
  return new signalR.HubConnectionBuilder()
    .withUrl(`${apiBaseUrl}/hubs/pour`, {
      accessTokenFactory: () => token,
    })
    .withAutomaticReconnect()
    .build();
}

async function joinBarGroup(connection) {
  console.log(`[STAFF] Joining bar group ${barId}...`);
  await withTimeout(
    connection.invoke("JoinBarGroup", barId),
    10000,
    `JoinBarGroup(${barId}) did not respond within 10 seconds`
  );
  console.log(`[STAFF] Joined bar group ${barId}. Waiting for NewPourRequest events...`);
}

function printToken(label, claims) {
  console.log(`\n${label} JWT claims:`);
  console.dir(claims, { depth: null, colors: true });
  if (claims.exp) {
    console.log(`${label} token expires at: ${new Date(claims.exp * 1000).toISOString()}`);
  }
}

function assertNotExpired(label, claims) {
  if (!claims.exp) return;

  const nowInSeconds = Math.floor(Date.now() / 1000);
  if (claims.exp <= nowInSeconds) {
    throw new Error(`${label} token is expired. Login again and use a fresh accessToken.`);
  }
}

function decodeJwtPayload(jwt) {
  try {
    const payload = jwt.split(".")[1];
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(normalized, "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return { error: "Could not decode JWT payload" };
  }
}

function withTimeout(promise, timeoutMs, message) {
  let timeout;
  const timeoutPromise = new Promise((_, reject) => {
    timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeout));
}

main().catch(err => {
  console.error("SignalR test failed:", err);
  process.exitCode = 1;
});
