import { OpenSeaClient, OpenSeaClientProps, NftPortClientProps, NftPortClient } from 'eth';
import { SolanaClient, SolanaClientProps } from 'sol'
import {
  Collectible,
  CollectibleState,
  CollectionInfo,
  NftPortCollectiblePaginationDto,
  NftPortCollectionInfoPaginationDto, NftPortCollectionPaginationDto,
} from 'utils/types';

import 'cross-fetch/polyfill'
import { NftPortAssetExtended } from './eth/types';

type FetchNFTClientProps = {
  openSeaConfig?: OpenSeaClientProps,
  solanaConfig?: SolanaClientProps
  nftPortConfig?: NftPortClientProps
}

export class FetchNFTClient {
  private openSeaClient: OpenSeaClient
  private solClient: SolanaClient
  private nftPortClient: NftPortClient

  constructor(props?: FetchNFTClientProps) {
    this.openSeaClient = new OpenSeaClient(props?.openSeaConfig ?? {})
    this.solClient = new SolanaClient(props?.solanaConfig ?? {})
    this.nftPortClient = new NftPortClient(props?.nftPortConfig ?? {})
  }

  public getCollectiblesFromOpenSea = async (wallets: string[]): Promise<CollectibleState> => (
    wallets.length ? await this.openSeaClient.getAllCollectibles(wallets) : {}
  )

  public getCollectiblesFromOpenSeaByContractAddressesAndTokenIds = async (wallet: string, contractAddresses: string[], tokenIds: string[]): Promise<Collectible[]> => (
    wallet ? await this.openSeaClient.getCollectiblesForWalletByContractAddressesAndTokenIds(wallet, contractAddresses, tokenIds) : null
  )

  public getEthereumCollection = async (assetContractAddress: string, tokenId: string, isDev: boolean): Promise<CollectionInfo> => {
    if (isDev) {
      return await this.nftPortClient.getCollection(assetContractAddress, tokenId);
    } else {
      let openSeaCollection, nftPorCollection;
      openSeaCollection = await this.openSeaClient.getCollection(assetContractAddress, tokenId);
      nftPorCollection = await this.nftPortClient.getCollection(assetContractAddress, tokenId);
      return openSeaCollection || nftPorCollection;
    }
  }

  public getAllCollectionsFromOpenSea = async (wallet: string): Promise<CollectionInfo[]> => {
    return await this.openSeaClient.getAllCollections(wallet);
  }

  public getCollectionsFromNftPort = async (wallet: string, limit: number, continuation: string): Promise<NftPortCollectionPaginationDto> => {
    return await this.nftPortClient.getCollections(wallet, limit, continuation);
  }

  public getAssetDetailFromOpenSea = async (assetContractAddress: string, tokenId: string): Promise<Collectible> => {
    return await this.openSeaClient.getAssetDetail(assetContractAddress, tokenId);
  }

  public getAssetDetailFromNftPort = async (assetContractAddress: string, tokenId: string): Promise<NftPortAssetExtended> => {
    return await this.nftPortClient.getAssetDetail(assetContractAddress, tokenId);
  }

  public getNftsFromNftPort = async (wallet: string, contractAddress: string, limit: number, continuation: string, exclude1155 = true): Promise<NftPortCollectiblePaginationDto> => {
    return await this.nftPortClient.getNfts(wallet, contractAddress, limit, continuation, exclude1155);
  }

  public getAssetOwner = async (assetContractAddress: string, tokenId: string): Promise<string> => {
    return await this.nftPortClient.getAssetOwner(assetContractAddress, tokenId);
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
        this.getCollectiblesFromOpenSea(args.ethWallets ?? []),
        this.getSolanaCollectibles(args.solWallets ?? [])
      ])
      return { ethCollectibles, solCollectibles }
    } catch (e) {
      console.error(e.message)
      return e
    }
  }
}

export { Collectible, CollectibleState, CollectionInfo, NftPortCollectionInfoPaginationDto }
