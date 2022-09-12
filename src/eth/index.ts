import {
  isAssetValid,
  assetToCollectible,
  creationEventToCollectible,
  transferEventToCollectible,
  isFromNullAddress,
} from 'eth/helpers';
import {
  OpenSeaAsset,
  OpenSeaAssetExtended,
  OpenSeaEvent,
  OpenSeaEventExtended,
} from 'eth/types';
import {
  Collectible,
  CollectibleState,
  CollectionInfo,
  NftPortCollectiblePaginationDto,
} from 'utils/types';

const OPENSEA_API_URL = 'https://api.opensea.io/api/v1';
const NFT_PORT_API_URL = 'https://api.nftport.xyz';

type AssetEventData = { asset_events: OpenSeaEvent[] }
type AssetEventResult = PromiseSettledResult<AssetEventData>
type AssetEventFulfilledResult = PromiseFulfilledResult<AssetEventData>

const parseAssetEventResults = (results: AssetEventResult[], wallets: string[]) => {
  return results
    .map((result, i) => ({ result, wallet: wallets[i] }))
    .filter(({ result }) => result.status === 'fulfilled')
    .map(
      ({ result, wallet }) =>
        (result as AssetEventFulfilledResult).value.asset_events?.map(event => ({
          ...event,
          asset: { ...event.asset, wallet },
          wallet,
        })) || [],
    )
    .flat();
};

type AssetData = { assets: OpenSeaAsset[] }
type AssetResult = PromiseSettledResult<AssetData>
type AssetFulfilledResult = PromiseFulfilledResult<AssetData>

const parseAssetResults = (results: AssetResult[], wallets: string[]) => {
  return results
    .map((result, i) => ({ result, wallet: wallets[i] }))
    .filter(({ result }) => result.status === 'fulfilled')
    .map(
      ({ result, wallet }) =>
        (result as AssetFulfilledResult).value.assets?.map(asset => ({ ...asset, wallet })) || [],
    )
    .flat();
};

export type OpenSeaClientProps = {
  apiEndpoint?: string
  apiKey?: string
  assetLimit?: number
  eventLimit?: number
}

export type NftPortClientProps = {
  apiEndpoint?: string
  apiKey?: string
  assetLimit?: number
  eventLimit?: number
  chain?: string
}

export class OpenSeaClient {
  readonly url: string = OPENSEA_API_URL;
  readonly apiKey: string = '';
  readonly assetLimit: number = 200;
  readonly eventLimit: number = 300;

  constructor(props?: OpenSeaClientProps) {
    this.url = props?.apiEndpoint ?? this.url;
    this.apiKey = props?.apiKey ?? this.apiKey;
    this.assetLimit = props?.assetLimit ?? this.assetLimit;
    this.eventLimit = props?.eventLimit ?? this.eventLimit;
  }

  private sendGetRequest = async (url = '') => {
    // Default options are marked with *
    const response = await fetch(url, {
      method: 'GET', // *GET, POST, PUT, DELETE, etc.
      mode: 'cors', // no-cors, *cors, same-origin
      cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
      credentials: 'same-origin', // include, *same-origin, omit
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': this.apiKey,
      },
      redirect: 'follow', // manual, *follow, error
      referrerPolicy: 'no-referrer', // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
    });
    return response.json(); // parses JSON response into native JavaScript objects
  };

  private getTransferredCollectiblesForWallet = async (
    wallet: string,
    limit = this.eventLimit,
  ): Promise<AssetEventData> => {
    return this.sendGetRequest(`${this.url}/events?account_address=${wallet}&limit=${limit}&event_type=transfer&only_opensea=false`).then(r => r);
  };

  private getTransferredCollectiblesForMultipleWallets = async (
    wallets: string[],
    limit = this.eventLimit,
  ): Promise<OpenSeaEventExtended[]> => {
    return Promise.allSettled(
      wallets.map(wallet => this.getTransferredCollectiblesForWallet(wallet, limit)),
    ).then(results => parseAssetEventResults(results, wallets));
  };

  private getCreatedCollectiblesForWallet = async (
    wallet: string,
    limit = this.eventLimit,
  ): Promise<AssetEventData> => {
    return this.sendGetRequest(`${this.url}/events?account_address=${wallet}&limit=${limit}&event_type=created&only_opensea=false`).then(r => r);

  };

  private getCreatedCollectiblesForMultipleWallets = async (
    wallets: string[],
    limit = this.eventLimit,
  ): Promise<OpenSeaEventExtended[]> => {
    return Promise.allSettled(
      wallets.map(wallet => this.getCreatedCollectiblesForWallet(wallet, limit)),
    ).then(results => parseAssetEventResults(results, wallets));
  };

  private getCollectiblesForWallet = async (
    wallet: string,
    limit = this.assetLimit,
  ): Promise<AssetData> => {
    let offset = 0;
    let result: any[] = [];
    try {
      while (1) {
        const item = await this.sendGetRequest(`${this.url}/assets?owner=${wallet}&offset=${offset}&limit=${limit}`);
        if (!item || (item && !item.assets) || (item && item.assets && item.assets.length === 0)) {
          break;
        }
        result = [...result, ...item.assets];
        offset += limit;
      }
    } catch (e) {
      console.log(e);
    } finally {
      return { assets: result };
    }
  };

  public getCollectiblesForWalletByContractAddressesAndTokenIds = async (
    wallet: string,
    contractAddresses: string[],
    tokenIds: string[]
  ): Promise<Collectible[]> => {
    if (!contractAddresses.length || !tokenIds.length || contractAddresses.length !== tokenIds.length) {
      return null;
    }
    let result = [];
    let url = `${this.url}/assets?owner=${wallet}`;
    url = contractAddresses.reduce((prev, current) => prev + `&asset_contract_addresses=${current}`, url);
    url = tokenIds.reduce((prev, current) => prev + `&token_ids=${current}`, url);
    try {
      const item = await this.sendGetRequest(url);
      if (!item || (item && !item.assets) || (item && item.assets && item.assets.length === 0)) {
        return null;
      }
      for await (const asset of item.assets) {
        const collectible = await assetToCollectible(asset);
        result.push(collectible);
      }
      return result;
    } catch (e) {
      console.log(e);
      return null;
    }
  };

  private getCollectiblesForMultipleWallets = async (
    wallets: string[],
    limit = this.assetLimit,
  ): Promise<OpenSeaAssetExtended[]> => {
    return Promise.allSettled(
      wallets.map(wallet => this.getCollectiblesForWallet(wallet, limit)),
    ).then(results => parseAssetResults(results, wallets));
  };

  public getCollection = async (assetContractAddress: string, tokenId: string): Promise<CollectionInfo> => {
    try {
      const result = await this.sendGetRequest(`${this.url}/asset/${assetContractAddress}/${tokenId}`);
      if (!result) {
        return null;
      }
      return {
        name: result?.collection?.name || '',
        slug: result?.collection?.slug || '',
        imageUrl: result?.collection?.image_url || '',
        contractAddress: (result?.collection?.primary_asset_contracts || []).reduce((prev: any, current: any) => (prev?.address || '') + `${prev?.address ? ',' : ''}` + (current?.address || ''), '') || '',
        safeListRequestStatus: result?.collection?.safelist_request_status,
        openListingCount: 0,
        closeListingCount: 0,
        openLoanCount: 0,
        closeLoanCount: 0,
      };
    } catch (e) {
      console.log(e);
      return null;
    }
  };

  public getAllCollections = async (wallet: string, limit = this.assetLimit,): Promise<CollectionInfo[]> => {
    let offset = 0;
    let result: any[] = [];
    try {
      while (1) {
        const response = await this.sendGetRequest(`${this.url}/collections?asset_owner=${wallet}&offset=${offset}&limit=${limit}`);
        if (!response || (response && !response.length)) {
          break;
        }
        result = [...result, ...response.map((item: any) => {
          return {
            name: item.name || '',
            slug: item?.slug || '',
            imageUrl: item?.image_url|| '',
            contractAddress: (item?.primary_asset_contracts || []).reduce((prev: any, current: any) => (prev?.address || '') + `${prev?.address ? ',' : ''}` + (current?.address || ''), '') || '',
            safeListRequestStatus: item?.safelist_request_status || '',
          }
        })];
        offset += limit;
      }
    } catch (e) {
      console.log(e);
    } finally {
      return result;
    }
  }

  public getAssetDetail = async (assetContractAddress: string, tokenId: string): Promise<Collectible> => {
    try {
      const result = await this.sendGetRequest(`${this.url}/asset/${assetContractAddress}/${tokenId}`);
      if (!result || (result && result.success && result.success.toString() === false)) {
        return null;
      }
      return assetToCollectible(result);
    } catch (e) {
      console.log(e);
      return null;
    }
  };

  public getAssetOwner = async (assetContractAddress: string, tokenId: string): Promise<string> => {
    try {
      const result = await this.sendGetRequest(`${this.url}/asset/${assetContractAddress}/${tokenId}`);
      return result?.owner?.address || null;
    } catch (e) {
      console.log(e);
      return null;
    }
  };

  public getAllCollectibles = async (wallets: string[]): Promise<CollectibleState> => {
    return Promise.all([
      this.getCollectiblesForMultipleWallets(wallets),
      this.getCreatedCollectiblesForMultipleWallets(wallets),
      this.getTransferredCollectiblesForMultipleWallets(wallets),
    ]).then(async ([assets, creationEvents, transferEvents]) => {
      const filteredAssets = assets.filter(
        asset => asset && isAssetValid(asset),
      );
      const collectibles = await Promise.all(
        filteredAssets.map(async asset => await assetToCollectible(asset)),
      );
      const collectiblesMap: {
        [key: string]: Collectible
      } = collectibles.reduce(
        (acc, curr) => ({
          ...acc,
          [curr.id]: curr,
        }),
        {},
      );
      const ownedCollectibleKeySet = new Set(Object.keys(collectiblesMap));

      // Handle transfers from NullAddress as if they were created events
      const firstOwnershipTransferEvents = transferEvents
        .filter(
          event =>
            event?.asset &&
            isAssetValid(event.asset) &&
            isFromNullAddress(event),
        )
        .reduce((acc: { [key: string]: OpenSeaEventExtended }, curr) => {
          const { token_id, asset_contract } = curr.asset;
          const id = `${token_id}:::${asset_contract?.address ?? ''}`;
          if (
            acc[id] &&
            acc[id].created_date.localeCompare(curr.created_date) > 0
          ) {
            return acc;
          }
          return { ...acc, [id]: curr };
        }, {});
      await Promise.all(
        Object.entries(firstOwnershipTransferEvents).map(async entry => {
          const [id, event] = entry;
          if (ownedCollectibleKeySet.has(id)) {
            collectiblesMap[id] = {
              ...collectiblesMap[id],
              dateLastTransferred: event.created_date,
            };
          } else {
            ownedCollectibleKeySet.add(id);
            collectiblesMap[id] = await transferEventToCollectible(event, false);
          }
          return event;
        }),
      );

      // Handle created events
      await Promise.all(
        creationEvents
          .filter(event => event?.asset && isAssetValid(event.asset))
          .map(async event => {
            const { token_id, asset_contract } = event.asset;
            const id = `${token_id}:::${asset_contract?.address ?? ''}`;
            if (!ownedCollectibleKeySet.has(id)) {
              collectiblesMap[id] = await creationEventToCollectible(event);
              ownedCollectibleKeySet.add(id);
            }
            return event;
          }),
      );

      // Handle transfers
      const latestTransferEventsMap = transferEvents
        .filter(
          event =>
            event?.asset &&
            isAssetValid(event.asset) &&
            !isFromNullAddress(event),
        )
        .reduce((acc: { [key: string]: OpenSeaEventExtended }, curr) => {
          const { token_id, asset_contract } = curr.asset;
          const id = `${token_id}:::${asset_contract?.address ?? ''}`;
          if (
            acc[id] &&
            acc[id].created_date.localeCompare(curr.created_date) > 0
          ) {
            return acc;
          }
          return { ...acc, [id]: curr };
        }, {});
      await Promise.all(
        Object.values(latestTransferEventsMap).map(async event => {
          const { token_id, asset_contract } = event.asset;
          const id = `${token_id}:::${asset_contract?.address ?? ''}`;
          if (ownedCollectibleKeySet.has(id)) {
            collectiblesMap[id] = {
              ...collectiblesMap[id],
              dateLastTransferred: event.created_date,
            };
          } else if (wallets.includes(event.to_account.address)) {
            ownedCollectibleKeySet.add(id);
            collectiblesMap[id] = await transferEventToCollectible(event);
          }
          return event;
        }),
      );

      return Object.values(collectiblesMap).reduce(
        (result, collectible) => ({
          ...result,
          [collectible.wallet]: (result[collectible.wallet] || []).concat([
            collectible,
          ]),
        }),
        {} as CollectibleState,
      );
    });
  };
}


export class NftPortClient {
  readonly url: string = NFT_PORT_API_URL;
  readonly apiKey: string = '';
  readonly assetLimit: number = 50;
  readonly chain: string = 'ethereum';

  constructor(props?: NftPortClientProps) {
    this.url = props?.apiEndpoint ?? this.url;
    this.apiKey = props?.apiKey ?? this.apiKey;
    this.assetLimit = props?.assetLimit ? (props?.assetLimit > this.assetLimit ? this.assetLimit : props?.assetLimit) : this.assetLimit;
    this.chain = props?.chain ?? this.chain;
  }

  private sendGetRequest = async (url = '') => {
    // Default options are marked with *
    const response = await fetch(url, {
      method: 'GET', // *GET, POST, PUT, DELETE, etc.
      mode: 'cors', // no-cors, *cors, same-origin
      cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
      credentials: 'same-origin', // include, *same-origin, omit
      headers: {
        'Content-Type': 'application/json',
        'Authorization': this.apiKey,
      },
      redirect: 'follow', // manual, *follow, error
      referrerPolicy: 'no-referrer', // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
    });
    return response.json(); // parses JSON response into native JavaScript objects
  };

  public getNfts = async (
    wallet: string,
    contractAddress: string,
    limit = this.assetLimit,
    continuation: string
  ): Promise<NftPortCollectiblePaginationDto> => {
    try {
      const item = await this.sendGetRequest(`${this.url}/v0/accounts/${wallet}?chain=${this.chain}&page_size=${limit}${continuation ? ('&continuation=' + continuation) : ''}${contractAddress ? ('&contract_address=' + contractAddress) : ''}`);
      if (!item || (item && !item?.nfts) || (item && item?.nfts && item.nfts?.length === 0)) {
        return {
          data: [],
          continuation: null,
          count: 0
        };
      }
      const data = item.nfts.map((item: any) => {
        return {
          tokenId: item?.token_id,
          assetContractAddress: item?.contract_address
        }
      });
      return {
        data,
        continuation: item.continuation,
        count: item.total
      };
    } catch (e) {
      console.log(e);
      return {
        data: [],
        continuation: null,
        count: 0
      };
    }
  };

  public getAllCollections = async (wallet: string): Promise<CollectionInfo[]> => {
    try {
      let result: any[] = [];
      let continuation = null;
      while (1) {
        const item = await this.sendGetRequest(`${this.url}/v0/accounts/contracts/${wallet}?chain=${this.chain}&type=owns_contract_nfts&page_size=${this.assetLimit}${continuation ? ('&continuation=' + continuation) : ''}`);
        if (!item || (item && !item?.contracts) || (item && item?.contracts && item?.contracts.length === 0)) {
          break;
        }
        result = [...result, ...item?.contracts.map((item: any) => {
          return {
            name: item.name || '',
            slug: item?.slug || '',
            imageUrl: item?.metadata?.thumbnail_url || '',
            contractAddress: (item?.address || '').toLowerCase(),
            safeListRequestStatus: item?.safelist_request_status || '',
          }
        })];
        if (!item.continuation) {
          break;
        }
      }
      return result;
    } catch (e) {
      console.log(e);
      return [];
    }
  };

  public getAssetOwner = async (assetContractAddress: string, tokenId: string): Promise<string> => {
    const result = await this.sendGetRequest(`${this.url}/v0/nfts/${assetContractAddress}/${tokenId}?chain=${this.chain}`);
    if (result && result.owner) {
      return result?.owner;
    }
    return null;
  };

}
