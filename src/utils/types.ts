import { Nullable } from 'utils/typeUtils';

import { NftPortAssetExtended } from '../eth/types';

export type Chain = 'eth' | 'sol';

export type CollectibleMediaType =
  | 'IMAGE'
  | 'VIDEO'
  | 'GIF'
  | 'THREE_D'
  | 'AUDIO'
  | 'HTML';

export enum AssetStatus {
  New = 'NEW',
  Ready = 'READY',
  Listed = 'LISTED',
  Locked = 'LOCKED',
  Transferred = 'TRANSFERRED',
}

export type Collectible = {
  id?: string;
  tokenId: string;
  openseaId?: Nullable<string>;
  name: Nullable<string>;
  description: Nullable<string>;
  mediaType: CollectibleMediaType;
  frameUrl: Nullable<string>;
  imageUrl: Nullable<string>;
  gifUrl: Nullable<string>;
  videoUrl: Nullable<string>;
  threeDUrl: Nullable<string>;
  isOwned: boolean;
  dateCreated?: Nullable<string>;
  dateLastTransferred?: Nullable<string>;
  externalLink?: Nullable<string>;
  permaLink?: Nullable<string>;
  assetContractAddress: Nullable<string>;
  chain: Chain;
  wallet: string;
  collection?: any;
  owner?: any;
  status?: AssetStatus;
  fileUrl?: string;
  magicUrl?: string;
  contentType?: string;
  contentLength?: number;
};

export type NftPortCollectiblePaginationDto = {
  data: NftPortAssetExtended[];
  continuation?: string;
  count: number;
};

export type NftPortCollectionPaginationDto = {
  data: CollectionInfo[];
  continuation?: string;
  count: number;
};

export type NftPortCollectionInfoPaginationDto = {
  data: CollectionInfo[];
  continuation?: string;
  count: number;
};

export type CollectionInfo = {
  name: string;
  slug: string;
  imageUrl: string;
  contractAddress: string;
  numNftsOwned?: number;
  verified?: boolean;
  openListingCount?: number;
  closeListingCount?: number;
  openLoanCount?: number;
  closeLoanCount?: number;
};

export type CollectibleState = {
  [wallet: string]: Collectible[];
};
