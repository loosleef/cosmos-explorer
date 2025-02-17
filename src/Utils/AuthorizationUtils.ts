import * as msal from "@azure/msal-browser";
import { AuthType } from "../AuthType";
import * as Constants from "../Common/Constants";
import * as Logger from "../Common/Logger";
import { configContext } from "../ConfigContext";
import * as ViewModels from "../Contracts/ViewModels";
import { userContext } from "../UserContext";

export function getAuthorizationHeader(): ViewModels.AuthorizationTokenHeaderMetadata {
  if (userContext.authType === AuthType.EncryptedToken) {
    return {
      header: Constants.HttpHeaders.guestAccessToken,
      token: userContext.accessToken,
    };
  } else {
    return {
      header: Constants.HttpHeaders.authorization,
      token: userContext.authorizationToken || "",
    };
  }
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function decryptJWTToken(token: string) {
  if (!token) {
    Logger.logError("Cannot decrypt token: No JWT token found", "AuthorizationUtils/decryptJWTToken");
    throw new Error("No JWT token found");
  }
  const tokenParts = token.split(".");
  if (tokenParts.length < 2) {
    Logger.logError(`Invalid JWT token: ${token}`, "AuthorizationUtils/decryptJWTToken");
    throw new Error(`Invalid JWT token: ${token}`);
  }
  let tokenPayloadBase64: string = tokenParts[1];
  tokenPayloadBase64 = tokenPayloadBase64.replace(/-/g, "+").replace(/_/g, "/");
  const tokenPayload = decodeURIComponent(
    atob(tokenPayloadBase64)
      .split("")
      .map((p) => "%" + ("00" + p.charCodeAt(0).toString(16)).slice(-2))
      .join(""),
  );

  return JSON.parse(tokenPayload);
}

export function getMsalInstance() {
  const config: msal.Configuration = {
    cache: {
      cacheLocation: "localStorage",
    },
    auth: {
      authority: `${configContext.AAD_ENDPOINT}organizations`,
      clientId: "203f1145-856a-4232-83d4-a43568fba23d",
    },
  };

  if (process.env.NODE_ENV === "development") {
    config.auth.redirectUri = "https://dataexplorer-dev.azurewebsites.net";
  }
  const msalInstance = new msal.PublicClientApplication(config);
  return msalInstance;
}
