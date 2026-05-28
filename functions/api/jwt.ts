// --- Native JSON Web Token (JWT) Utility using Web Crypto API (HMAC-SHA256) ---
// This file provides elegant, dependency-free signing and verification of JWTs.
// Designed specifically for Cloudflare Pages serverless isolate runtime.

export class SimpleJWT {
  // Base64URL encoder helper
  private static base64UrlEncode(str: string): string {
    const base64 = btoa(str);
    return base64.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  }

  // Base64URL decoder helper
  private static base64UrlDecode(str: string): string {
    let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) {
      base64 += "=";
    }
    return atob(base64);
  }

  // Helper to convert Uint8Array/binary to base64url string
  private static binToBase64Url(bin: Uint8Array): string {
    let str = "";
    for (let i = 0; i < bin.length; i++) {
      str += String.fromCharCode(bin[i]);
    }
    return this.base64UrlEncode(str);
  }

  /**
   * Cryptographically signs a payload using HMAC-SHA256.
   * @param payload JSON serializable payload containing claims (e.g. role, exp)
   * @param secret The secret string used for HMAC signing
   * @returns Signed JWT string (header.payload.signature)
   */
  static async sign(payload: Record<string, any>, secret: string): Promise<string> {
    const header = { alg: "HS256", typ: "JWT" };
    
    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedPayload = this.base64UrlEncode(JSON.stringify(payload));
    
    const tokenWithoutSignature = `${encodedHeader}.${encodedPayload}`;
    const encoder = new TextEncoder();
    
    // Import raw secret key for HMAC-SHA256
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: { name: "SHA-256" } },
      false,
      ["sign"]
    );
    
    // Sign the token header+payload
    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(tokenWithoutSignature)
    );
    
    const signatureArray = new Uint8Array(signatureBuffer);
    const encodedSignature = this.binToBase64Url(signatureArray);
    
    return `${tokenWithoutSignature}.${encodedSignature}`;
  }

  /**
   * Verifies and decodes a cryptographically signed JWT.
   * Checks expiration claim ('exp') if present.
   * @param token Signed JWT string (header.payload.signature)
   * @param secret The secret string used for verification
   * @returns Decoded payload object if valid, or null if invalid or expired
   */
  static async verify(token: string, secret: string): Promise<Record<string, any> | null> {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    
    const [header, payload, signature] = parts;
    const tokenWithoutSignature = `${header}.${payload}`;
    const encoder = new TextEncoder();
    
    try {
      // Import raw secret key for HMAC-SHA256 validation
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "HMAC", hash: { name: "SHA-256" } },
        false,
        ["verify"]
      );
      
      // Decode base64url signature back to binary bytes
      const rawSignatureStr = this.base64UrlDecode(signature);
      const signatureBytes = new Uint8Array(rawSignatureStr.length);
      for (let i = 0; i < rawSignatureStr.length; i++) {
        signatureBytes[i] = rawSignatureStr.charCodeAt(i);
      }
      
      // Verify signature
      const isValid = await crypto.subtle.verify(
        "HMAC",
        key,
        signatureBytes,
        encoder.encode(tokenWithoutSignature)
      );
      
      if (!isValid) return null;
      
      // Decode and parse payload
      const decodedPayloadStr = this.base64UrlDecode(payload);
      const decodedPayload = JSON.parse(decodedPayloadStr);
      
      // Check expiration ('exp') claim
      if (decodedPayload.exp && Date.now() > decodedPayload.exp) {
        return null; // Expired token
      }
      
      return decodedPayload;
    } catch (e) {
      console.error("JWT verification exception:", e);
      return null;
    }
  }
}
