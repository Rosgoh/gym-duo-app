import type { Exercise, Phase } from '../types/workout';
import { normalizeStr } from '../utils/stringUtils';

const SERVICE_ACCOUNT_EMAIL = import.meta.env.VITE_GOOGLE_SERVICE_ACCOUNT_EMAIL;
const PRIVATE_KEY = import.meta.env.VITE_GOOGLE_PRIVATE_KEY;

let cachedAccessToken: string | null = null;
let tokenExpiry: number = 0;

const getAccessToken = async (): Promise<string> => {
  if (cachedAccessToken && Date.now() < tokenExpiry) {
    return cachedAccessToken;
  }

  if (!SERVICE_ACCOUNT_EMAIL || !PRIVATE_KEY) {
    throw new Error('Missing Google Service Account credentials');
  }

  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: SERVICE_ACCOUNT_EMAIL,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const encodedHeader = btoa(JSON.stringify(header));
  const encodedClaim = btoa(JSON.stringify(claim));
  const signatureInput = `${encodedHeader}.${encodedClaim}`;

  const privateKeyFormatted = PRIVATE_KEY.replace(/\\n/g, '\n');
  
  const encoder = new TextEncoder();
  const data = encoder.encode(signatureInput);
  
  const pemHeader = '-----BEGIN PRIVATE KEY-----';
  const pemFooter = '-----END PRIVATE KEY-----';
  const pemContents = privateKeyFormatted.substring(
    privateKeyFormatted.indexOf(pemHeader) + pemHeader.length,
    privateKeyFormatted.indexOf(pemFooter)
  ).replace(/\s/g, '');
  
  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, data);
  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const jwt = `${encodedHeader}.${encodedClaim}.${encodedSignature}`;

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!tokenResponse.ok) {
    throw new Error('Failed to get access token');
  }

  const tokenData = await tokenResponse.json();
  cachedAccessToken = tokenData.access_token;
  tokenExpiry = Date.now() + (tokenData.expires_in * 1000) - 60000;

  return tokenData.access_token;
};

export const fetchExercisesByPhaseAndDay = async (
  spreadsheetId: string,
  phase: Phase,
  day: number
): Promise<Exercise[]> => {
  if (!spreadsheetId) {
    throw new Error('Missing spreadsheetId');
  }

  const accessToken = await getAccessToken();
  const range = `Fase${phase}!A2:H`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch exercises: ${response.statusText}`);
    }

    const data = await response.json();
    const rows: string[][] = data.values || [];

    const exercises = rows
      .filter(row => parseInt(row[2]) === day)
      .map((row, index) => ({
        id: `${phase}-${day}-${index}`,
        nombre: row[0] || '',
        video_url: row[1] || '',
        dia: String(parseInt(row[2]) || day),
        fase: Number(phase),
        series_reps: row[3] || '',
        nombre_alternativa: row[4] || '',
        video_url_alternativa: row[5] || '',
      }));

    return exercises;
  } catch (error) {
    console.error(`[SheetsService Error] Failed fetching with ID: ${spreadsheetId}`);
    console.error('[SheetsService Error] Error fetching exercises from Google Sheets:', error);
    throw error;
  }
};

export const getExercisesByContext = async (
  spreadsheetId: string,
  targetDay: string,
  targetPhase: number
): Promise<Exercise[]> => {
  if (!spreadsheetId) {
    throw new Error('Missing spreadsheetId');
  }

  const accessToken = await getAccessToken();
  const range = 'Ejercicios!A2:J';
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch exercises: ${response.statusText}`);
    }

    const data = await response.json();
    const rows: string[][] = data.values || [];

    const normalizedTargetDay = normalizeStr(targetDay);
    const normalizedTargetPhase = Number(targetPhase);

    const exercises = rows
      .map((row, index) => {
        const dia = row[1] || '';
        const fase = Number(row[2]);

        return {
          id: row[0] || `${normalizedTargetDay}-${targetPhase}-${index}`,
          dia,
          fase,
          nombre: row[3] || '',
          video_url: row[7] || '',
          series_reps: `${row[5] || ''} x ${row[6] || ''}`.trim(),
          nombre_alternativa: row[8] || '',
          video_url_alternativa: row[9] || '',
        } satisfies Exercise;
      })
      .filter((row) => {
        return normalizeStr(row.dia) === normalizedTargetDay && Number(row.fase) === normalizedTargetPhase;
      });

    return exercises;
  } catch (error) {
    console.error(`[SheetsService Error] Failed fetching with ID: ${spreadsheetId}`);
    console.error('[SheetsService Error] Error fetching exercises from Google Sheets:', error);
    throw error;
  }
};
