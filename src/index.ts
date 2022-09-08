import { OpenSeaClient, OpenSeaClientProps, NftPortClientProps, NftPortClient } from 'eth';
import { SolanaClient, SolanaClientProps } from 'sol'
import {Collectible, CollectibleState, CollectionInfo, NftPortCollectible} from 'utils/types'

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

  public getEthereumCollection = async (assetContractAddress: string, tokenId: string): Promise<CollectionInfo> => {
    return await this.ethClient.getCollection(assetContractAddress, tokenId);
  }

  public getEthereumAssetDetail = async (assetContractAddress: string, tokenId: string): Promise<Collectible> => {
    return await this.ethClient.getAssetDetail(assetContractAddress, tokenId);
  }

  public getAllNftsFromNftPort = async (wallet: string): Promise<NftPortCollectible[]> => {
    return await this.nftPortClient.getAllNfts(wallet);
  }

  public getEthereumAssetOwner = async (assetContractAddress: string, tokenId: string): Promise<string> => {
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
