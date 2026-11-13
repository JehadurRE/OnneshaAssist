import { CertificateData, LedgerOtsCheckpoint } from "./types";
import { CertificateSigningKeys, getNodeCrypto, getNodeFsSafe } from "./server-security";

// ============================================================================
// 1. W3C DID:WEB & VERIFIABLE CREDENTIALS (Ed25519 / Multikey)
// ============================================================================

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/** Encode raw bytes into Bitcoin/Multibase Base58btc string (no external dependency). */
export function encodeBase58Btc(bytes: Uint8Array): string {
  if (bytes.length === 0) return "";
  const digits: number[] = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let i = 0; i < digits.length; i++) {
      const val = (digits[i] || 0) * 256 + carry;
      digits[i] = val % 58;
      carry = Math.floor(val / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  let output = "";
  for (const byte of bytes) {
    if (byte === 0) output += "1";
    else break;
  }
  for (let i = digits.length - 1; i >= 0; i--) {
    output += BASE58_ALPHABET[digits[i] || 0] || "";
  }
  return output;
}

/** Deterministic sorted-key JSON serializer for canonical W3C VC signing/verification. */
export function canonicalJsonStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJsonStringify(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const sortedKeys = Object.keys(record)
    .filter((k) => record[k] !== undefined)
    .sort();
  return `{${sortedKeys
    .map((k) => `${JSON.stringify(k)}:${canonicalJsonStringify(record[k])}`)
    .join(",")}}`;
}

export function ed25519PemToMultibase(publicKeyPem: string): string | null {
  const crypto = getNodeCrypto();
  if (!crypto) return null;
  try {
    const spkiDer = crypto.createPublicKey(publicKeyPem).export({ format: "der", type: "spki" });
    if (spkiDer.length < 32) return null;
    const rawKey = spkiDer.subarray(spkiDer.length - 32);
    // Multicodec varint header for ed25519-pub (0xed01) -> [0xed, 0x01]
    const prefixed = Buffer.concat([Buffer.from([0xed, 0x01]), rawKey]);
    return `z${encodeBase58Btc(prefixed)}`;
  } catch {
    return null;
  }
}

export function ed25519PemToJwk(publicKeyPem: string): Record<string, unknown> | null {
  const crypto = getNodeCrypto();
  if (!crypto) return null;
  try {
    return crypto.createPublicKey(publicKeyPem).export({ format: "jwk" }) as Record<
      string,
      unknown
    >;
  } catch {
    return null;
  }
}

export function normalizeOriginHost(originOrUrl?: string): string {
  const raw = (originOrUrl || "").trim() || "arena.onnesha.courses";
  try {
    const parsed = raw.includes("://") ? new URL(raw) : new URL(`https://${raw}`);
    return parsed.host || "arena.onnesha.courses";
  } catch {
    return raw.replace(/^https?:\/\//i, "").split("/")[0] || "arena.onnesha.courses";
  }
}

/** Build standard W3C did:web identifier from site origin or host header. */
export function hostToDidWeb(originOrHost?: string): string {
  const host = normalizeOriginHost(originOrHost);
  return `did:web:${host.replace(/:/g, "%3A")}`;
}

export interface JwkPublicKey {
  kty: string;
  crv?: string | undefined;
  x?: string | undefined;
  y?: string | undefined;
}

export interface DidVerificationMethod {
  id: string;
  type: string;
  controller: string;
  publicKeyMultibase?: string | undefined;
  publicKeyJwk?: JwkPublicKey | undefined;
}

export interface W3CDidDocument {
  "@context": string[];
  id: string;
  verificationMethod: DidVerificationMethod[];
  authentication: string[];
  assertionMethod: string[];
}

export function buildDidDocument(
  originOrHost: string,
  certKeys: CertificateSigningKeys,
  rekorKeys?: TransparencySigningKeys | null,
): W3CDidDocument {
  const did = hostToDidWeb(originOrHost);
  const multibase = ed25519PemToMultibase(certKeys.publicKeyPem);
  const rawEdJwk = ed25519PemToJwk(certKeys.publicKeyPem);
  const edJwk: JwkPublicKey | null = rawEdJwk
    ? {
        kty: String(rawEdJwk["kty"] || "OKP"),
        ...(rawEdJwk["crv"] ? { crv: String(rawEdJwk["crv"]) } : {}),
        ...(rawEdJwk["x"] ? { x: String(rawEdJwk["x"]) } : {}),
      }
    : null;
  const keyFragment = multibase || certKeys.keyId;
  const primaryMethodId = `${did}#${keyFragment}`;

  const verificationMethods: DidVerificationMethod[] = [
    {
      id: primaryMethodId,
      type: "Ed25519VerificationKey2020",
      controller: did,
      ...(multibase ? { publicKeyMultibase: multibase } : {}),
      ...(edJwk ? { publicKeyJwk: edJwk } : {}),
    },
  ];

  if (rekorKeys) {
    const crypto = getNodeCrypto();
    const rawEcJwk = crypto
      ? (crypto.createPublicKey(rekorKeys.publicKeyPem).export({ format: "jwk" }) as Record<
          string,
          unknown
        >)
      : null;
    const ecJwk: JwkPublicKey | null = rawEcJwk
      ? {
          kty: String(rawEcJwk["kty"] || "EC"),
          ...(rawEcJwk["crv"] ? { crv: String(rawEcJwk["crv"]) } : {}),
          ...(rawEcJwk["x"] ? { x: String(rawEcJwk["x"]) } : {}),
          ...(rawEcJwk["y"] ? { y: String(rawEcJwk["y"]) } : {}),
        }
      : null;
    verificationMethods.push({
      id: `${did}#rekor-${rekorKeys.keyId}`,
      type: "JsonWebKey2020",
      controller: did,
      ...(ecJwk ? { publicKeyJwk: ecJwk } : {}),
    });
  }

  return {
    "@context": [
      "https://www.w3.org/ns/did/v1",
      "https://w3id.org/security/suites/ed25519-2020/v1",
      "https://w3id.org/security/suites/jws-2020/v1",
    ],
    id: did,
    verificationMethod: verificationMethods,
    authentication: [primaryMethodId],
    assertionMethod: [primaryMethodId],
  };
}

export interface W3CCredentialSubject {
  id: string;
  certificateNumber: string;
  name: string;
  rollNumber: string;
  regionName: string;
  assessmentTitle: string;
  scoreObtained: number;
  totalMarks: number;
  rank: number;
  totalParticipants: number;
  accuracyPercent: number;
  issueDate: string;
}

export interface W3CCredentialEvidence {
  type: string[];
  ledgerIndex?: number | null;
  payloadHash?: string | null;
  prevBlockHash?: string | null;
  chainHash?: string | null;
  signerKeyId?: string | null;
  ed25519ChainSignature?: string | null;
  kind?: string;
  apiVersion?: string;
  entryUuid?: string;
  logIndex?: number | null;
  integratedTime?: number | null;
  logId?: string | null;
  zeroPiiReceiptDigestSha256?: string | null;
  explorerUrl?: string | null;
  status?: string;
  anchoredLedgerIndex?: number | null;
  anchoredChainHash?: string | null;
  calendarUrl?: string | null;
  bitcoinBlockHeight?: number | null;
  otsProofBase64?: string;
}

export interface W3CVerifiableCredential {
  "@context": string[];
  id: string;
  type: string[];
  issuer: {
    id: string;
    name: string;
  };
  validFrom: string;
  credentialSubject: W3CCredentialSubject;
  evidence: W3CCredentialEvidence[];
  proof: {
    type: string;
    created: string;
    verificationMethod: string;
    proofPurpose: string;
    challenge: string;
    proofValue: string;
  };
}

export function buildW3CVerifiableCredential(
  cert: CertificateData,
  certKeys: CertificateSigningKeys,
  options?: {
    originUrl?: string | undefined;
    checkpoint?: LedgerOtsCheckpoint | undefined;
  },
): W3CVerifiableCredential {
  const originUrl = (options?.originUrl || "https://arena.onnesha.courses").replace(/\/+$/, "");
  const did = hostToDidWeb(originUrl);
  const multibase = ed25519PemToMultibase(certKeys.publicKeyPem);
  const verificationMethod = `${did}#${multibase || certKeys.keyId}`;
  const validFrom =
    cert.signedAt || `${cert.issueDate || new Date().toISOString().slice(0, 10)}T00:00:00Z`;

  const evidence: W3CCredentialEvidence[] = [
    {
      type: ["OnneshaCryptographicLedgerProof"],
      ledgerIndex: cert.ledgerIndex ?? null,
      payloadHash: cert.payloadHash ?? null,
      prevBlockHash: cert.prevBlockHash ?? null,
      chainHash: cert.chainHash ?? null,
      signerKeyId: cert.signerKeyId || certKeys.keyId,
      ed25519ChainSignature: cert.cryptoSignature ?? null,
    },
  ];

  if (cert.rekorStatus === "anchored" && cert.rekorEntryUuid) {
    evidence.push({
      type: ["SigstoreRekorTransparencyEntry"],
      kind: "hashedrekord",
      apiVersion: "0.0.1",
      entryUuid: cert.rekorEntryUuid,
      logIndex: cert.rekorLogIndex ?? null,
      integratedTime: cert.rekorIntegratedTime ?? null,
      logId: cert.rekorLogId ?? null,
      zeroPiiReceiptDigestSha256: cert.rekorReceiptDigest ?? null,
      explorerUrl: cert.rekorExplorerUrl ?? null,
    });
  }

  const otsProof = cert.otsProofBase64 || options?.checkpoint?.otsProofBase64;
  if (otsProof) {
    evidence.push({
      type: ["OpenTimestampsBitcoinAnchor"],
      status: cert.otsStatus || options?.checkpoint?.status || "pending_bitcoin",
      anchoredLedgerIndex: cert.otsLedgerIndex ?? options?.checkpoint?.ledgerIndex ?? null,
      anchoredChainHash: cert.otsChainHash || options?.checkpoint?.chainHash || null,
      calendarUrl: cert.otsCalendarUrl || options?.checkpoint?.calendarUrl || null,
      bitcoinBlockHeight:
        cert.otsBitcoinBlockHeight ?? options?.checkpoint?.bitcoinBlockHeight ?? null,
      otsProofBase64: otsProof,
    });
  }

  const unsignedCredential = {
    "@context": [
      "https://www.w3.org/ns/credentials/v2",
      "https://w3id.org/security/suites/ed25519-2020/v1",
    ],
    id: `${originUrl}/verify/${encodeURIComponent(cert.certificateNumber)}`,
    type: ["VerifiableCredential", "AcademicAchievementCredential"],
    issuer: {
      id: did,
      name: cert.institutionName || cert.organizationName || "Onnesha Assessment Arena",
    },
    validFrom,
    credentialSubject: {
      id: `urn:onnesha:candidate:${(cert.studentRoll || cert.id || "unknown").replace(/[^a-zA-Z0-9_-]/g, "")}`,
      certificateNumber: cert.certificateNumber,
      name: cert.studentName,
      rollNumber: cert.studentRoll || "",
      regionName: cert.regionName || "",
      assessmentTitle: cert.quizTitle,
      scoreObtained: Number(cert.marksObtained ?? cert.score ?? 0),
      totalMarks: Number(cert.totalMarks ?? cert.totalPoints ?? 100),
      rank: Number(cert.rank || 1),
      totalParticipants: Number(cert.totalParticipants || 1),
      accuracyPercent: Number(cert.accuracyPercent ?? cert.scorePct ?? 0),
      issueDate: cert.issueDate,
    },
    evidence,
  };

  const crypto = getNodeCrypto();
  let proofValue = "";
  if (crypto) {
    const digestHex = crypto
      .createHash("sha256")
      .update(canonicalJsonStringify(unsignedCredential), "utf8")
      .digest("hex");
    const sigBytes = crypto.sign(null, Buffer.from(digestHex, "utf8"), certKeys.privateKeyPem);
    proofValue = `z${encodeBase58Btc(sigBytes)}`;
  }

  return {
    ...unsignedCredential,
    proof: {
      type: "Ed25519Signature2020",
      created: validFrom,
      verificationMethod,
      proofPurpose: "assertionMethod",
      challenge: cert.chainHash || cert.payloadHash || cert.certificateNumber,
      proofValue,
    },
  };
}

/** Cryptographically verify an exported W3C Verifiable Credential against the issuer Ed25519 PEM key. */
export function verifyW3CVerifiableCredentialProof(
  vc: W3CVerifiableCredential,
  publicKeyPem: string,
): boolean {
  const crypto = getNodeCrypto();
  if (!crypto || !vc.proof?.proofValue?.startsWith("z")) return false;
  try {
    const { proof: _proof, ...unsigned } = vc;
    const digestHex = crypto
      .createHash("sha256")
      .update(canonicalJsonStringify(unsigned), "utf8")
      .digest("hex");

    // Decode base58btc
    const encoded = vc.proof.proofValue.slice(1);
    const bytes: number[] = [0];
    for (const char of encoded) {
      const value = BASE58_ALPHABET.indexOf(char);
      if (value < 0) return false;
      let carry = value;
      for (let i = 0; i < bytes.length; i++) {
        const next = (bytes[i] || 0) * 58 + carry;
        bytes[i] = next & 0xff;
        carry = next >> 8;
      }
      while (carry > 0) {
        bytes.push(carry & 0xff);
        carry >>= 8;
      }
    }
    for (const char of encoded) {
      if (char === "1") bytes.push(0);
      else break;
    }
    const sigBytes = Buffer.from(bytes.reverse());
    return crypto.verify(null, Buffer.from(digestHex, "utf8"), publicKeyPem, sigBytes);
  } catch {
    return false;
  }
}

// ============================================================================
// 2. SIGSTORE REKOR INSTANT TRANSPARENCY ANCHORING (hashedrekord v0.0.1)
// ============================================================================

export interface TransparencySigningKeys {
  publicKeyPem: string;
  privateKeyPem: string;
  keyId: string;
}

let cachedRekorKeys: TransparencySigningKeys | null = null;

function fingerprintKeyPem(publicKeyPem: string): string {
  const crypto = getNodeCrypto();
  if (!crypto) return "unavailable";
  return crypto.createHash("sha256").update(publicKeyPem, "utf8").digest("hex").slice(0, 12);
}

/**
 * ECDSA P-256 (prime256v1) transparency keypair used specifically for Sigstore Rekor hashedrekord
 * v0.0.1 entries, which natively validate ECDSA-SHA256 digests directly without double-hashing.
 */
export function getRekorAnchorKeys(dataDir?: string): TransparencySigningKeys | null {
  const crypto = getNodeCrypto();
  if (!crypto) return null;

  const envPriv =
    typeof process !== "undefined" ? process.env["REKOR_PRIVATE_KEY_PEM"]?.trim() : undefined;
  const envPub =
    typeof process !== "undefined" ? process.env["REKOR_PUBLIC_KEY_PEM"]?.trim() : undefined;
  if (envPriv && envPub) {
    const pub = envPub.replace(/\\n/g, "\n");
    return {
      privateKeyPem: envPriv.replace(/\\n/g, "\n"),
      publicKeyPem: pub,
      keyId: fingerprintKeyPem(pub),
    };
  }

  if (cachedRekorKeys) return cachedRekorKeys;

  const fs = getNodeFsSafe();
  if (fs && dataDir) {
    try {
      const keyFile = `${dataDir}/.onnesha-rekor-p256.json`;
      if (fs.existsSync(keyFile)) {
        const raw = JSON.parse(
          fs.readFileSync(keyFile, "utf-8"),
        ) as Partial<TransparencySigningKeys>;
        if (raw.privateKeyPem && raw.publicKeyPem) {
          cachedRekorKeys = {
            privateKeyPem: raw.privateKeyPem,
            publicKeyPem: raw.publicKeyPem,
            keyId: raw.keyId || fingerprintKeyPem(raw.publicKeyPem),
          };
          return cachedRekorKeys;
        }
      }

      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      const generated = crypto.generateKeyPairSync("ec", {
        namedCurve: "prime256v1",
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
      });
      const bundle: TransparencySigningKeys = {
        publicKeyPem: generated.publicKey,
        privateKeyPem: generated.privateKey,
        keyId: fingerprintKeyPem(generated.publicKey),
      };
      fs.writeFileSync(keyFile, JSON.stringify(bundle), { mode: 0o600 });
      cachedRekorKeys = bundle;
      return bundle;
    } catch {
      // Fall through to ephemeral
    }
  }

  const ephemeral = crypto.generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  cachedRekorKeys = {
    publicKeyPem: ephemeral.publicKey,
    privateKeyPem: ephemeral.privateKey,
    keyId: fingerprintKeyPem(ephemeral.publicKey),
  };
  return cachedRekorKeys;
}

/** Compute zero-PII transparency receipt and SHA-256 digest from the opaque ledger chainHash. */
export function computeZeroPiiRekorReceipt(chainHash: string): {
  receiptText: string;
  receiptDigestHex: string;
} {
  const crypto = getNodeCrypto();
  const receiptText = `onnesha:v1:chain:${chainHash}`;
  const receiptDigestHex = crypto
    ? crypto.createHash("sha256").update(receiptText, "utf8").digest("hex")
    : "";
  return { receiptText, receiptDigestHex };
}

export function buildRekorHashedRekordPayload(
  chainHash: string,
  rekorKeys: TransparencySigningKeys,
): { payload: Record<string, unknown>; receiptDigestHex: string } {
  const crypto = getNodeCrypto();
  const { receiptText, receiptDigestHex } = computeZeroPiiRekorReceipt(chainHash);
  if (!crypto) {
    throw new Error("Node crypto is required to build Rekor payload");
  }
  const signatureDer = crypto.sign(
    "sha256",
    Buffer.from(receiptText, "utf8"),
    rekorKeys.privateKeyPem,
  );
  const payload = {
    apiVersion: "0.0.1",
    kind: "hashedrekord",
    spec: {
      data: {
        hash: {
          algorithm: "sha256",
          value: receiptDigestHex,
        },
      },
      signature: {
        content: signatureDer.toString("base64"),
        publicKey: {
          content: Buffer.from(rekorKeys.publicKeyPem, "utf8").toString("base64"),
        },
      },
    },
  };
  return { payload, receiptDigestHex };
}

interface RawRekorEntryValue {
  logID?: string;
  logIndex?: number;
  integratedTime?: number;
}

function parseRekorEntryMap(
  json: unknown,
  receiptDigestHex: string,
  publicKeyId: string,
): Partial<CertificateData> | null {
  if (!json || typeof json !== "object") return null;
  const mapObj = Array.isArray(json)
    ? (json[0] as Record<string, RawRekorEntryValue> | undefined)
    : (json as Record<string, RawRekorEntryValue>);
  if (!mapObj || typeof mapObj !== "object") return null;
  const firstUuid = Object.keys(mapObj)[0];
  if (!firstUuid) return null;
  const entry = mapObj[firstUuid];
  if (!entry || typeof entry.logIndex !== "number") return null;

  return {
    rekorEntryUuid: firstUuid,
    rekorLogIndex: entry.logIndex,
    rekorIntegratedTime: entry.integratedTime,
    rekorLogId: entry.logID,
    rekorStatus: "anchored",
    rekorReceiptDigest: receiptDigestHex,
    rekorPublicKeyId: publicKeyId,
    rekorExplorerUrl: `https://search.sigstore.dev/?logIndex=${entry.logIndex}`,
  };
}

export async function anchorCertificateToRekor(
  cert: CertificateData,
  options?: {
    dataDir?: string | undefined;
    keysOverride?: TransparencySigningKeys | undefined;
    rekorBaseUrl?: string | undefined;
    timeoutMs?: number | undefined;
    fetchImpl?: typeof fetch | undefined;
  },
): Promise<{
  anchored: boolean;
  fields: Partial<CertificateData>;
  error?: string;
}> {
  if (!cert.chainHash) {
    return { anchored: false, fields: {}, error: "Certificate missing chainHash" };
  }
  const rekorKeys = options?.keysOverride || getRekorAnchorKeys(options?.dataDir);
  if (!rekorKeys) {
    return { anchored: false, fields: {}, error: "Crypto unavailable" };
  }

  const { payload, receiptDigestHex } = buildRekorHashedRekordPayload(cert.chainHash, rekorKeys);
  const fallbackFields: Partial<CertificateData> = {
    rekorStatus: "pending_retry",
    rekorReceiptDigest: receiptDigestHex,
    rekorPublicKeyId: rekorKeys.keyId,
  };

  if (
    typeof process !== "undefined" &&
    process.env["REKOR_ENABLED"] === "false" &&
    !options?.fetchImpl
  ) {
    return { anchored: false, fields: fallbackFields, error: "Rekor anchoring disabled by config" };
  }

  const baseUrl = (
    options?.rekorBaseUrl ||
    (typeof process !== "undefined" ? process.env["REKOR_BASE_URL"] : undefined) ||
    "https://rekor.sigstore.dev"
  ).replace(/\/+$/, "");
  const fetcher = options?.fetchImpl || globalThis.fetch;
  if (!fetcher) {
    return { anchored: false, fields: fallbackFields, error: "fetch API unavailable" };
  }

  const timeoutMs = options?.timeoutMs ?? 4000;
  try {
    const res = await fetcher(`${baseUrl}/api/v1/log/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (res.ok) {
      const body = await res.json();
      const parsed = parseRekorEntryMap(body, receiptDigestHex, rekorKeys.keyId);
      if (parsed) {
        return { anchored: true, fields: parsed };
      }
    }

    // 409 Conflict -> Entry already logged on Rekor; recover canonical entry via retrieve/Location
    if (res.status === 409) {
      const location = res.headers.get("Location");
      if (location) {
        const targetUrl = location.startsWith("http") ? location : `${baseUrl}${location}`;
        const existingRes = await fetcher(targetUrl, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (existingRes.ok) {
          const parsed = parseRekorEntryMap(
            await existingRes.json(),
            receiptDigestHex,
            rekorKeys.keyId,
          );
          if (parsed) return { anchored: true, fields: parsed };
        }
      }

      const retrieveRes = await fetcher(`${baseUrl}/api/v1/log/entries/retrieve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ entries: [payload] }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (retrieveRes.ok) {
        const parsed = parseRekorEntryMap(
          await retrieveRes.json(),
          receiptDigestHex,
          rekorKeys.keyId,
        );
        if (parsed) return { anchored: true, fields: parsed };
      }
    }

    return {
      anchored: false,
      fields: fallbackFields,
      error: `Rekor returned HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      anchored: false,
      fields: fallbackFields,
      error: err instanceof Error ? err.message : "Rekor network failure",
    };
  }
}

// ============================================================================
// 3. OPENTIMESTAMPS (BITCOIN) LEDGER CHECKPOINT ANCHORING
// ============================================================================

export const OTS_HEADER_MAGIC = Buffer.from(
  "004f70656e54696d657374616d7073000050726f6f6600bf89e2e884e89294",
  "hex",
);
export const OTS_VERSION_BYTE = 0x01;
export const OTS_OP_SHA256 = 0x08;
export const OTS_PENDING_ATTESTATION_TAG = Buffer.from("83dfe30d2ef90c8e", "hex");
export const OTS_BITCOIN_ATTESTATION_TAG = Buffer.from("0588960d73d71901", "hex");

/** Assemble standard binary `.ots` proof file from 32-byte digest and calendar `/digest` stream. */
export function wrapOtsDigestResponseToFileBytes(
  digest32Bytes: Uint8Array,
  calendarBodyBytes: Uint8Array,
): Buffer {
  return Buffer.concat([
    OTS_HEADER_MAGIC,
    Buffer.from([OTS_VERSION_BYTE, OTS_OP_SHA256]),
    Buffer.from(digest32Bytes),
    Buffer.from(calendarBodyBytes),
  ]);
}

function readOtsVarint(buf: Buffer, offset: number): { value: number; nextOffset: number } | null {
  let result = 0;
  let shift = 0;
  let pos = offset;
  while (pos < buf.length && shift <= 35) {
    const byte = buf[pos];
    if (byte === undefined) return null;
    result |= (byte & 0x7f) << shift;
    pos += 1;
    if ((byte & 0x80) === 0) {
      return { value: result, nextOffset: pos };
    }
    shift += 7;
  }
  return null;
}

export function inspectOtsProofStatus(otsBytes: Buffer): {
  validHeader: boolean;
  status: "pending_bitcoin" | "bitcoin_confirmed";
  bitcoinBlockHeight?: number | undefined;
} {
  const validHeader =
    otsBytes.length > OTS_HEADER_MAGIC.length + 34 &&
    otsBytes.subarray(0, OTS_HEADER_MAGIC.length).equals(OTS_HEADER_MAGIC);

  const btcTagIdx = otsBytes.indexOf(OTS_BITCOIN_ATTESTATION_TAG);
  if (btcTagIdx >= 0) {
    const payloadOffset = btcTagIdx + OTS_BITCOIN_ATTESTATION_TAG.length;
    const lenVar = readOtsVarint(otsBytes, payloadOffset);
    const heightVar = lenVar ? readOtsVarint(otsBytes, lenVar.nextOffset) : null;
    return {
      validHeader,
      status: "bitcoin_confirmed",
      bitcoinBlockHeight: heightVar?.value,
    };
  }

  return {
    validHeader,
    status: "pending_bitcoin",
  };
}

export async function anchorDigestToOpenTimestamps(
  chainHashHex: string,
  options?: {
    calendars?: string[] | undefined;
    timeoutMs?: number | undefined;
    fetchImpl?: typeof fetch | undefined;
  },
): Promise<{
  success: boolean;
  otsProofBase64?: string;
  calendarUrl?: string;
  status?: "pending_bitcoin" | "bitcoin_confirmed";
  bitcoinBlockHeight?: number | undefined;
  error?: string;
}> {
  if (!/^[a-f0-9]{64}$/i.test(chainHashHex)) {
    return { success: false, error: "Invalid SHA-256 chainHash" };
  }
  if (
    typeof process !== "undefined" &&
    process.env["OTS_ENABLED"] === "false" &&
    !options?.fetchImpl
  ) {
    return { success: false, error: "OpenTimestamps disabled by config" };
  }

  const fetcher = options?.fetchImpl || globalThis.fetch;
  if (!fetcher) {
    return { success: false, error: "fetch API unavailable" };
  }

  const digestBytes = Buffer.from(chainHashHex, "hex");
  const calendars = options?.calendars?.length
    ? options.calendars
    : ["https://a.pool.opentimestamps.org", "https://b.pool.opentimestamps.org"];
  const timeoutMs = options?.timeoutMs ?? 4500;

  let lastErr = "Calendar servers unreachable";
  for (const cal of calendars) {
    const base = cal.replace(/\/+$/, "");
    try {
      const res = await fetcher(`${base}/digest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          Accept: "application/octet-stream",
        },
        body: new Uint8Array(digestBytes),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) {
        lastErr = `Calendar ${base} returned HTTP ${res.status}`;
        continue;
      }
      const rawBody = Buffer.from(await res.arrayBuffer());
      if (rawBody.length === 0) {
        lastErr = `Calendar ${base} returned empty proof`;
        continue;
      }
      const fullOts = wrapOtsDigestResponseToFileBytes(digestBytes, rawBody);
      const inspected = inspectOtsProofStatus(fullOts);
      return {
        success: true,
        otsProofBase64: fullOts.toString("base64"),
        calendarUrl: base,
        status: inspected.status,
        bitcoinBlockHeight: inspected.bitcoinBlockHeight,
      };
    } catch (err) {
      lastErr = err instanceof Error ? err.message : "OpenTimestamps network error";
    }
  }

  return { success: false, error: lastErr };
}
