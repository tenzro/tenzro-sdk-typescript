import type { RpcClient } from './rpc';

// ── Types ──

/** Information about an NFT collection. */
export interface CollectionInfo {
  /** Unique collection identifier */
  collection_id: string;
  /** Collection name */
  name: string;
  /** Collection ticker symbol */
  symbol: string;
  /** NFT type (e.g. "ERC-721", "ERC-1155") */
  nft_type: string;
  /** Creator address */
  creator: string;
  /** EVM contract address for the collection */
  evm_address: string;
}

/** Result of minting an NFT. */
export interface NftMintResult {
  /** Collection the NFT was minted in */
  collection_id: string;
  /** Token ID of the newly minted NFT */
  token_id: string;
  /** Recipient address */
  recipient: string;
  /** Transaction hash */
  tx_hash?: string;
}

/** Information about a specific NFT or collection. */
export interface NftInfo {
  /** Collection identifier */
  collection_id: string;
  /** Token ID (omitted when querying collection-level info) */
  token_id?: string;
  /** NFT or collection name */
  name: string;
  /** Metadata URI (e.g. IPFS link) */
  metadata_uri?: string;
  /** Current owner address */
  owner?: string;
}

/** Result of transferring an NFT. */
export interface NftTransferResult {
  /** Transaction hash */
  tx_hash: string;
  /** Collection identifier */
  collection_id: string;
  /** Token ID */
  token_id: string;
  /** Sender address */
  from: string;
  /** Recipient address */
  to: string;
  /** Status */
  status: string;
}

/** Result of registering a cross-VM pointer for an NFT collection. */
export interface NftPointerResult {
  /** Collection identifier */
  collection_id: string;
  /** Target VM (e.g. "svm", "daml") */
  target_vm: string;
  /** Pointer address on the target VM */
  target_address: string;
  /** Transaction hash */
  tx_hash?: string;
  /** Status */
  status: string;
}

// ── Client ──

/**
 * Client for NFT collection and token management.
 * Supports creating collections, minting NFTs, transferring ownership,
 * querying metadata, and registering cross-VM pointers for NFT contracts.
 */
export class NftClient {
  constructor(private readonly rpc: RpcClient) {}

  /**
   * Create a new NFT collection via the factory.
   * @param name - Collection name (e.g. "Tenzro Founders")
   * @param symbol - Collection ticker symbol (e.g. "TFNDR")
   * @param nftType - NFT standard type (e.g. "ERC-721", "ERC-1155")
   * @param creator - Creator address
   * @returns Information about the newly created collection
   */
  async createCollection(
    name: string,
    symbol: string,
    nftType: string,
    creator: string
  ): Promise<CollectionInfo> {
    return this.rpc.call<CollectionInfo>('tenzro_createNftCollection', [
      { name, symbol, nft_type: nftType, creator },
    ]);
  }

  /**
   * Mint a new NFT in an existing collection.
   * @param collectionId - Collection identifier
   * @param tokenId - Token ID to mint
   * @param recipient - Recipient address
   * @param metadataUri - Metadata URI (e.g. IPFS CID or HTTPS URL)
   * @returns Mint result with token ID and transaction hash
   */
  async mintNft(
    collectionId: string,
    tokenId: string,
    recipient: string,
    metadataUri: string
  ): Promise<NftMintResult> {
    return this.rpc.call<NftMintResult>('tenzro_mintNft', [
      {
        collection_id: collectionId,
        token_id: tokenId,
        recipient,
        metadata_uri: metadataUri,
      },
    ]);
  }

  /**
   * Transfer an NFT from one address to another.
   * @param collectionId - Collection identifier
   * @param tokenId - Token ID to transfer
   * @param from - Current owner address
   * @param to - Recipient address
   * @returns Transfer result with transaction hash
   */
  async transferNft(
    collectionId: string,
    tokenId: string,
    from: string,
    to: string
  ): Promise<NftTransferResult> {
    return this.rpc.call<NftTransferResult>('tenzro_transferNft', [
      { collection_id: collectionId, token_id: tokenId, from, to },
    ]);
  }

  /**
   * Get information about a collection or a specific NFT.
   * @param collectionId - Collection identifier
   * @param tokenId - Optional token ID; omit to get collection-level info
   * @returns NFT or collection information
   */
  async getNftInfo(collectionId: string, tokenId?: string): Promise<NftInfo> {
    return this.rpc.call<NftInfo>('tenzro_getNftInfo', [
      { collection_id: collectionId, token_id: tokenId },
    ]);
  }

  /**
   * List NFT collections, optionally filtered by creator.
   * @param creator - Optional creator address filter
   * @returns Array of collection information
   */
  async listCollections(creator?: string): Promise<CollectionInfo[]> {
    return this.rpc.call<CollectionInfo[]>('tenzro_listNftCollections', [
      { creator },
    ]);
  }

  /**
   * Register a cross-VM pointer for an NFT collection so it can be
   * accessed from another VM (e.g. SVM or DAML) using the Sei V2 pointer model.
   * @param collectionId - Collection identifier
   * @param targetVm - Target VM (e.g. "svm", "daml")
   * @param targetAddress - Pointer address on the target VM
   * @returns Pointer registration result
   */
  async registerPointer(
    collectionId: string,
    targetVm: string,
    targetAddress: string
  ): Promise<NftPointerResult> {
    return this.rpc.call<NftPointerResult>('tenzro_registerNftPointer', [
      {
        collection_id: collectionId,
        target_vm: targetVm,
        target_address: targetAddress,
      },
    ]);
  }
}
