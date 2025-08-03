// ABOUTME: GitHub API client for fetching CIS benchmark data from Fleet repository
// ABOUTME: Provides async methods to list folders and fetch YAML content

/**
 * GitHub API client for fetching CIS benchmark data.
 */
export class GitHubClient {
  private readonly baseUrl: string = "https://api.github.com";
  private readonly repoOwner: string = "fleetdm";
  private readonly repoName: string = "fleet";

  /**
   * List all directories under ee/cis/ in the Fleet repository.
   * 
   * @returns Promise resolving to list of folder names sorted alphabetically
   * @throws Error if the API request fails or returns unexpected data
   */
  async listFolders(): Promise<string[]> {
    const url = `${this.baseUrl}/repos/${this.repoOwner}/${this.repoName}/contents/ee/cis`;
    
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`GitHub API request failed: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json() as Array<{ name: string; type: string }>;
      
      // Filter for directories only and extract names
      const folderNames = data
        .filter(item => item.type === "dir")
        .map(item => item.name)
        .sort();
      
      return folderNames;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to fetch folder list: ${error.message}`);
      }
      throw new Error("Failed to fetch folder list: Unknown error");
    }
  }

  /**
   * Fetch the cis-policy-queries.yml file for a specific folder.
   * 
   * @param folder The folder name under ee/cis/ to fetch YAML from
   * @returns Promise resolving to the raw YAML content as a string
   * @throws Error if the YAML file is not found (404) or other errors occur
   */
  async fetchYaml(folder: string): Promise<string> {
    const url = `https://raw.githubusercontent.com/${this.repoOwner}/${this.repoName}/refs/heads/main/ee/cis/${folder}/cis-policy-queries.yml`;
    
    try {
      const response = await fetch(url);
      
      if (response.status === 404) {
        throw new Error(`YAML file not found for folder: ${folder}`);
      }
      
      if (!response.ok) {
        throw new Error(`Failed to fetch YAML: ${response.status} ${response.statusText}`);
      }
      
      return await response.text();
    } catch (error) {
      if (error instanceof Error) {
        throw error; // Re-throw our custom errors
      }
      throw new Error(`Failed to fetch YAML for ${folder}: Unknown error`);
    }
  }
}

/**
 * Synchronous wrapper for listFolders() using top-level await.
 * 
 * @returns Promise resolving to list of folder names sorted alphabetically
 */
export async function listFoldersSync(): Promise<string[]> {
  const client = new GitHubClient();
  return await client.listFolders();
}

/**
 * Synchronous wrapper for fetchYaml() using top-level await.
 * 
 * @param folder The folder name under ee/cis/ to fetch YAML from
 * @returns Promise resolving to the raw YAML content as a string
 */
export async function fetchYamlSync(folder: string): Promise<string> {
  const client = new GitHubClient();
  return await client.fetchYaml(folder);
}