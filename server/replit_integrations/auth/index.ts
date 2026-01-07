export { getSession } from "./replitAuth";
export { setupGoogleAuth, isAuthenticated, initializeSessionAndPassport } from "./googleAuth";
export { setupLocalAuth } from "./localAuth";
export { authStorage, type IAuthStorage } from "./storage";
export { registerAuthRoutes } from "./routes";
