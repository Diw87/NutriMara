export interface ClinicClient {
  request: (path: string, init?: RequestInit) => Promise<Response>;
  photoUrl: (id: number, view: "front" | "side") => Promise<string>;
  assetUrl: (name: string) => string;
}

export const serverClient: ClinicClient = {
  request: (path, init) => fetch(path, init),
  photoUrl: async (id, view) => `/api/photos?id=${id}&view=${view}`,
  assetUrl: name => `/${name}`,
};
