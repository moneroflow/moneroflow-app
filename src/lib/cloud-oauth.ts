// Cloud OAuth Provider Configuration
// Pre-registered OAuth apps (operator-configured) for one-click user connect

export interface CloudProviderConfig {
  id: string;
  name: string;
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  clientId: string;
}

export const CLOUD_PROVIDER_CONFIGS: Record<string, CloudProviderConfig> = {
  dropbox: {
    id: 'dropbox',
    name: 'Dropbox',
    authUrl: 'https://www.dropbox.com/oauth2/authorize',
    tokenUrl: 'https://api.dropboxapi.com/oauth2/token',
    scopes: ['files.content.write', 'files.content.read'],
    clientId: '', // To be configured by operator
  },
  google: {
    id: 'google',
    name: 'Google Drive',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: ['https://www.googleapis.com/auth/drive.file'],
    clientId: '', // To be configured by operator
  },
};

export function isProviderConfigured(provider: string): boolean {
  const config = CLOUD_PROVIDER_CONFIGS[provider];
  return !!(config && config.clientId);
}

export function isProviderConnected(provider: string): boolean {
  const key = `cloud_token_${provider}`;
  return !!localStorage.getItem(key);
}

export function initiateOAuth(provider: string): void {
  const config = CLOUD_PROVIDER_CONFIGS[provider];
  if (!config || !config.clientId) {
    throw new Error(`Provider ${provider} not configured`);
  }

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  sessionStorage.setItem('oauth_code_verifier', codeVerifier);

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: `${window.location.origin}/oauth/callback`,
    response_type: 'code',
    scope: config.scopes.join(' '),
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state: provider,
  });

  window.location.href = `${config.authUrl}?${params.toString()}`;
}

export async function detectAndHandleOAuthCallback(): Promise<boolean> {
  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const codeVerifier = sessionStorage.getItem('oauth_code_verifier');

  if (!code || !state || !codeVerifier) {
    return false;
  }

  window.history.replaceState({}, '', window.location.pathname);
  sessionStorage.removeItem('oauth_code_verifier');

  const config = CLOUD_PROVIDER_CONFIGS[state];
  if (!config) {
    throw new Error('Unknown provider');
  }

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      code,
      code_verifier: codeVerifier,
      grant_type: 'authorization_code',
      redirect_uri: `${window.location.origin}/oauth/callback`,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to exchange code for token');
  }

  const tokenData = await response.json();
  localStorage.setItem(`cloud_token_${state}`, JSON.stringify(tokenData));

  return true;
}

export function clearCloudToken(provider: string): void {
  localStorage.removeItem(`cloud_token_${provider}`);
}

export async function uploadBackupToCloud(
  provider: string,
  filename: string,
  content: string
): Promise<void> {
  const tokenStr = localStorage.getItem(`cloud_token_${provider}`);
  if (!tokenStr) {
    throw new Error('Not connected to cloud provider');
  }

  const token = JSON.parse(tokenStr);
  const config = CLOUD_PROVIDER_CONFIGS[provider];

  if (!config) {
    throw new Error('Unknown provider');
  }

  if (provider === 'dropbox') {
    const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({
          path: `/${filename}`,
          mode: 'overwrite',
          autorename: false,
          mute: false,
        }),
      },
      body: content,
    });

    if (!response.ok) {
      throw new Error('Failed to upload to Dropbox');
    }
  } else if (provider === 'google') {
    const metadata = {
      name: filename,
      mimeType: 'application/octet-stream',
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([content], { type: 'application/octet-stream' }));

    const response = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token.access_token}`,
        },
        body: form,
      }
    );

    if (!response.ok) {
      throw new Error('Failed to upload to Google Drive');
    }
  }
}

// PKCE Helpers
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  return crypto.subtle.digest('SHA-256', data).then(buffer => {
    return base64UrlEncode(new Uint8Array(buffer));
  });
}

function base64UrlEncode(buffer: Uint8Array): string {
  let str = '';
  buffer.forEach(b => str += String.fromCharCode(b));
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
