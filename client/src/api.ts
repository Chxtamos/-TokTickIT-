const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface Category {
  id: number;
  name: string;
}

export interface DevelopmentRequester {
  id: number;
  name: string;
}

export interface SystemStatus {
  online: boolean;
  categories: Category[];
}

export async function checkSystem(): Promise<SystemStatus> {
  const healthResponse = await fetch(`${API_URL}/api/health`);

  if (!healthResponse.ok) {
    throw new Error("Unable to connect to TokTickIT API");
  }

  const health = (await healthResponse.json()) as {
    status: string;
    service: string;
  };

  if (health.status !== "ok" || health.service !== "TokTickIT API") {
    throw new Error("TokTickIT API returned an invalid response");
  }

  const categoriesResponse = await fetch(`${API_URL}/api/categories`);

  if (!categoriesResponse.ok) {
    throw new Error("Unable to load IT request categories");
  }

  const categories = (await categoriesResponse.json()) as Category[];

  return {
    online: true,
    categories,
  };
}

export async function getDevelopmentRequesters(): Promise<DevelopmentRequester[]> {
  const response = await fetch(`${API_URL}/api/development-requesters`);
  if (!response.ok) throw new Error("Unable to load Development Requesters");
  const requesters = (await response.json()) as DevelopmentRequester[];
  if (!Array.isArray(requesters)) throw new Error("TokTickIT API returned an invalid Requester response");
  return requesters;
}
