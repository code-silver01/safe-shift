import neo4j, { Driver, Session } from "neo4j-driver";

let driver: Driver | null = null;
let connected = false;

export const connectNeo4j = async (): Promise<void> => {
  const uri = process.env.NEO4J_URI || "bolt://localhost:7687";
  const user = process.env.NEO4J_USER || "neo4j";
  const password = process.env.NEO4J_PASSWORD || "password";

  try {
    driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
      maxConnectionPoolSize: 100,
      connectionTimeout: 5000,
    });

    await driver.verifyConnectivity();
    connected = true;
    console.log(`[DB] Neo4j connected to: ${uri}`);
  } catch (error) {
    console.warn("[DB] Neo4j connection failed — running in OFFLINE mode.");
    console.warn("[DB] The TS Compiler Graph, Local Router, and Coverage engines will still work.");
    console.warn("[DB] To enable Neo4j features, start Neo4j and set NEO4J_URI/NEO4J_USER/NEO4J_PASSWORD.");
    driver = null;
    connected = false;
    // DON'T exit — the server can run without Neo4j
  }
};

export const isNeo4jConnected = (): boolean => connected;

export const getDriver = (): Driver => {
  if (!driver) throw new Error("Neo4j Driver not initialized. Running in offline mode.");
  return driver;
};

export const getSession = (): Session => {
  return getDriver().session();
};

export const closeNeo4j = async (): Promise<void> => {
  if (driver) {
    await driver.close();
    console.log("[DB] Neo4j connection closed.");
  }
};

