import neo4j, { Driver, Session } from "neo4j-driver";

let driver: Driver | null = null;

export const connectNeo4j = async (): Promise<void> => {
  const uri = process.env.NEO4J_URI || "bolt://localhost:7687";
  const user = process.env.NEO4J_USER || "neo4j";
  const password = process.env.NEO4J_PASSWORD || "password";

  try {
    // Disable logging warnings for development ease, or use standard console
    driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
      maxConnectionPoolSize: 100,
    });
    
    await driver.verifyConnectivity();
    console.log(`[DB] Neo4j connected to: ${uri}`);
  } catch (error) {
    console.error("[DB] Neo4j connection error:", error);
    process.exit(1);
  }
};

export const getDriver = (): Driver => {
  if (!driver) throw new Error("Neo4j Driver not initialized.");
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
