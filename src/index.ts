import { OpenSeaClient, OpenSeaClientProps, NftPortClientProps, NftPortClient } from 'eth';
import { SolanaClient, SolanaClientProps } from 'sol'
import {
  Collectible,
  CollectibleState,
  CollectionInfo,
  NftPortCollectiblePaginationDto,
} from 'utils/types';

import 'cross-fetch/polyfill'

type FetchNFTClientProps = {
  openSeaConfig?: OpenSeaClientProps,
  solanaConfig?: SolanaClientProps
  nftPortConfig?: NftPortClientProps
}

export class FetchNFTClient {
  private ethClient: OpenSeaClient
  private solClient: SolanaClient
  private nftPortClient: NftPortClient

  constructor(props?: FetchNFTClientProps) {
    this.ethClient = new OpenSeaClient(props?.openSeaConfig ?? {})
    this.solClient = new SolanaClient(props?.solanaConfig ?? {})
    this.nftPortClient = new NftPortClient(props?.nftPortConfig ?? {})
  }

  public getEthereumCollectibles = async (wallets: string[]): Promise<CollectibleState> => (
    wallets.length ? await this.ethClient.getAllCollectibles(wallets) : {}
  )

  public getEthereumCollectiblesByContractAddressesAndTokenIds = async (wallet: string, contractAddresses: string[], tokenIds: string[]): Promise<Collectible[]> => (
    wallet ? await this.ethClient.getCollectiblesForWalletByContractAddressesAndTokenIds(wallet, contractAddresses, tokenIds) : null
  )

  public getEthereumCollection = async (assetContractAddress: string, tokenId: string): Promise<CollectionInfo> => {
    return await this.ethClient.getCollection(assetContractAddress, tokenId);
  }

  public getAllCollectionsFromOpensea = async (wallet: string): Promise<CollectionInfo[]> => {
    return await this.ethClient.getAllCollections(wallet);
  }

  public getAllCollectionsFromNftPort = async (wallet: string): Promise<CollectionInfo[]> => {
    return await this.nftPortClient.getAllCollections(wallet);
  }

  public getEthereumAssetDetail = async (assetContractAddress: string, tokenId: string): Promise<Collectible> => {
    return await this.ethClient.getAssetDetail(assetContractAddress, tokenId);
  }

  public getNftsFromNftPort = async (wallet: string, contractAddress: string, limit: number, continuation: string): Promise<NftPortCollectiblePaginationDto> => {
    return await this.nftPortClient.getNfts(wallet, contractAddress, limit, continuation);
  }

  public getEthereumAssetOwner = async (assetContractAddress: string, tokenId: string): Promise<string> => {
    const nftPortOwner = await this.nftPortClient.getAssetOwner(assetContractAddress, tokenId);
    const openSeaOwner = await this.ethClient.getAssetOwner(assetContractAddress, tokenId);
    return nftPortOwner || openSeaOwner;
  }

  public getSolanaCollectibles = async (wallets: string[]): Promise<CollectibleState> => (
    wallets.length ? await this.solClient.getAllCollectibles(wallets) : {}
  )

  public getCollectibles = async (args: {
    ethWallets?: string[]
    solWallets?: string[]
  }): Promise<{
    ethCollectibles: CollectibleState
    solCollectibles: CollectibleState
  }> => {
    try {
      const [ethCollectibles, solCollectibles] = await Promise.all([
        this.getEthereumCollectibles(args.ethWallets ?? []),
        this.getSolanaCollectibles(args.solWallets ?? [])
      ])
      return { ethCollectibles, solCollectibles }
    } catch (e) {
      console.error(e.message)
      return e
    }
  }
}

export { Collectible, CollectibleState, CollectionInfo }
