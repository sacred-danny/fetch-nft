import axios, { AxiosResponse, AxiosError } from "axios";
import { NftPortAssetExtended, OpenSeaAssetExtended, OpenSeaEvent, OpenSeaEventExtended } from 'eth/types';
import { AssetStatus, Collectible, CollectibleMediaType } from 'utils/types';

/**
 * extensions based on OpenSea metadata standards
 * https://docs.opensea.io/docs/metadata-standards
 */
const OPENSEA_AUDIO_EXTENSIONS = ['mp3', 'wav', 'oga'];
const OPENSEA_VIDEO_EXTENSIONS = [
  'gltf',
  'glb',
  'webm',
  'mp4',
  'm4v',
  'ogv',
  'ogg',
  'mov',
  'html',
  'htm'
];

const SUPPORTED_VIDEO_EXTENSIONS = ['webm', 'mp4', 'ogv', 'ogg', 'mov', 'html', 'htm'];
const SUPPORTED_3D_EXTENSIONS = ['gltf', 'glb'];

const NON_IMAGE_EXTENSIONS = [
  ...OPENSEA_VIDEO_EXTENSIONS,
  ...OPENSEA_AUDIO_EXTENSIONS,
];

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

const isAssetImage = (asset: OpenSeaAssetExtended | NftPortAssetExtended) => {
  return [
    asset.image_url,
    asset.image_original_url,
    asset.image_preview_url,
    asset.image_thumbnail_url,
  ].some(url => url && NON_IMAGE_EXTENSIONS.every(ext => !url.endsWith(ext)));
};

type ImageConvertResponse = {
  message?: string;
  error?: string;
  magic_url?: string;
  dir?: string;
};

const getGucUrl = (img_url: string): Promise<string> => {
  return axios
    .get<ImageConvertResponse>(
      `https://image-manager-363021.uk.r.appspot.com/?url=${img_url}`
    )
    .then((response: AxiosResponse) => {
      if (response.status === 200) {
        return response.data.magic_url;
      }
      return null;
    })
    .catch((e: AxiosError) => {
      console.log(e);
      return null;
    });
};


const areUrlExtensionsSupportedForType = (
  asset: OpenSeaAssetExtended | NftPortAssetExtended,
  extensions: string[],
) => {
  const {
    animation_url,
    animation_original_url,
    image_url,
    image_original_url,
    image_preview_url,
    image_thumbnail_url,
  } = asset;
  return [
    animation_url || '',
    animation_original_url || '',
    image_url,
    image_original_url,
    image_preview_url,
    image_thumbnail_url,
  ].some(url => url && extensions.some(ext => url.endsWith(ext)));
};

const isAssetVideo = (asset: OpenSeaAssetExtended | NftPortAssetExtended) => {
  return asset.animation_url || asset.animation_original_url;
};

const isAssetThreeDAndIncludesImage = (asset: OpenSeaAssetExtended | NftPortAssetExtended) => {
  return (
    areUrlExtensionsSupportedForType(asset, SUPPORTED_3D_EXTENSIONS) &&
    isAssetImage(asset)
  );
};

const isAssetGif = (asset: OpenSeaAssetExtended | NftPortAssetExtended) => {
  return !!(
    asset.image_url?.endsWith('.gif') ||
    asset.image_original_url?.endsWith('.gif') ||
    asset.image_preview_url?.endsWith('.gif') ||
    asset.image_thumbnail_url?.endsWith('.gif')
  );
};

export const isAssetValid = (asset: OpenSeaAssetExtended | NftPortAssetExtended) => {
  return (
    isAssetGif(asset) ||
    isAssetThreeDAndIncludesImage(asset) ||
    isAssetVideo(asset) ||
    isAssetImage(asset)
  );
};

export const IPFS_GATEWAY = 'https://balance.mypinata.cloud/ipfs';

const convertIpfsUrl = (url: string): string => {
  if (!url) {
    return null;
  }
  if (url.startsWith('ipfs://')) {
    return `${IPFS_GATEWAY}/${url.replace('ipfs://', '')}`;
  } else {
    const subUrls = url.split('ipfs/');
    if (subUrls.length > 1 && subUrls[1].length > 0) {
      return `${IPFS_GATEWAY}/${subUrls[1]}`;
    } else {
      return url;
    }
  }
};

/**
 * Returns a collectible given an asset object from the OpenSea API
 *
 * A lot of the work here is to determine whether a collectible is a gif, a video, or an image
 *
 * If the collectible is a gif, we set the gifUrl, and we process a frame from the gifUrl which we set as its frameUrl
 *
 * If the collectible is a video, we set the videoUrl, and we check whether the asset has an image
 * - if it has an image, we check whether the image url is an actual image or a video (sometimes OpenSea returns
 *   videos in the image url properties of the asset)
 *   - if it's an image, we set it as the frameUrl
 *   - otherwise, we unset the frameUrl
 * - if not, we do not set the frameUrl
 * Video collectibles that do not have a frameUrl will use the video paused at the first frame as the thumbnail
 * in the collectibles tab
 *
 * Otherwise, we consider the collectible to be an image, we get the image url and make sure that it is not
 * a gif or a video
 * - if it's a gif, we follow the above gif logic
 * - if it's a video, we unset the frameUrl and follow the above video logic
 * - otherwise, we set the frameUrl and the imageUrl
 *
 * @param asset
 */
export const assetToCollectible = async (
  asset: OpenSeaAssetExtended,
): Promise<Collectible> => {
  let mediaType: CollectibleMediaType;
  let frameUrl = null;
  let imageUrl = null;
  let videoUrl = null;
  let threeDUrl = null;
  let gifUrl = null;

  let { animation_url, animation_original_url } = asset;
  animation_url = convertIpfsUrl(animation_url);
  animation_original_url = convertIpfsUrl(animation_original_url);
  const imageUrls = [
    convertIpfsUrl(asset.image_url),
    convertIpfsUrl(asset.image_original_url),
    convertIpfsUrl(asset.image_preview_url),
    convertIpfsUrl(asset.image_thumbnail_url),
  ];

  try {
    if (isAssetGif(asset)) {
      mediaType = 'GIF';
      // frame url for the gif is computed later in the collectibles page
      frameUrl = null;
      gifUrl = imageUrls.find(url => url?.endsWith('.gif'))! ?? null;
    } else if (isAssetThreeDAndIncludesImage(asset)) {
      mediaType = 'THREE_D';
      threeDUrl = [animation_url, animation_original_url, ...imageUrls].find(
        url => url && SUPPORTED_3D_EXTENSIONS.some(ext => url.endsWith(ext)),
      )! ?? null;
      frameUrl = imageUrls.find(
        url => url && NON_IMAGE_EXTENSIONS.every(ext => !url.endsWith(ext)),
      )! ?? null;
      // image urls may not end in known extensions
      // just because the don't end with the NON_IMAGE_EXTENSIONS above does not mean they are images
      // they may be gifs
      // example: https://lh3.googleusercontent.com/rOopRU-wH9mqMurfvJ2INLIGBKTtF8BN_XC7KZxTh8PPHt5STSNJ-i8EQit8ZTwE3Mi8LK4on_4YazdC3Cl-HdaxbnKJ23P8kocvJHQ
      if (frameUrl && frameUrl.startsWith("http")) {
        const res = await fetch(frameUrl, { method: 'HEAD' });
        const hasGifFrame = res.headers.get('Content-Type')?.includes('gif');
        if (hasGifFrame) {
          gifUrl = frameUrl;
          // frame url for the gif is computed later in the collectibles page
          frameUrl = null;
        }
      }
    } else if (isAssetVideo(asset)) {
      mediaType = 'VIDEO';
      frameUrl =
        imageUrls.find(
          url => url && NON_IMAGE_EXTENSIONS.every(ext => !url.endsWith(ext)),
        ) ?? null;

      /**
       * make sure frame url is not a video or a gif
       * if it is, unset frame url so that component will use a video url frame instead
       */
      if (frameUrl && frameUrl.startsWith("http")) {
        const res = await fetch(frameUrl, { method: 'HEAD' });
        const isVideo = res.headers.get('Content-Type')?.includes('video');
        const isGif = res.headers.get('Content-Type')?.includes('gif');
        if (isVideo || isGif) {
          frameUrl = null;
        }
      }

      videoUrl = [animation_url, animation_original_url, ...imageUrls].find(
        url => url && SUPPORTED_VIDEO_EXTENSIONS.some(ext => url.endsWith(ext)),
      )! ?? null;
    } else {
      mediaType = 'IMAGE';
      frameUrl = imageUrls.find(url => !!url)! ?? null;
      if (frameUrl && frameUrl.startsWith("http")) {
        const res = await fetch(frameUrl, { method: 'HEAD' });
        const isGif = res.headers.get('Content-Type')?.includes('gif');
        const isVideo = res.headers.get('Content-Type')?.includes('video');
        if (isGif) {
          mediaType = 'GIF';
          gifUrl = frameUrl;
          // frame url for the gif is computed later in the collectibles page
          frameUrl = null;
        } else if (isVideo) {
          mediaType = 'VIDEO';
          frameUrl = null;
          videoUrl = imageUrls.find(url => !!url)! ?? null;
        } else {
          imageUrl = imageUrls.find(url => !!url)! ?? null;
        }
      }
    }
  } catch (e) {
    console.error('Error processing collectible', e);
    mediaType = 'IMAGE';
    frameUrl = imageUrls.find(url => !!url)! ?? null;
    imageUrl = frameUrl;
  }

  return {
    openseaId: (asset.id || '').toString(),
    tokenId: asset.token_id,
    name: (asset.name || asset?.asset_contract?.name) ?? '',
    description: asset.description,
    mediaType,
    frameUrl,
    imageUrl,
    videoUrl,
    threeDUrl,
    gifUrl,
    isOwned: true,
    dateCreated: null,
    dateLastTransferred: null,
    externalLink: asset.external_link,
    permaLink: asset.permalink,
    assetContractAddress: asset.asset_contract?.address ?? null,
    chain: 'eth',
    owner: asset.owner,
    wallet: asset.wallet,
    collection: asset.collection,
    status: AssetStatus.New,
  };
};

export const nftportAssetToCollectible = async (
  asset: NftPortAssetExtended,
): Promise<Collectible> => {
  let mediaType: CollectibleMediaType;
  let frameUrl = null;
  let imageUrl = null;
  let videoUrl = null;
  let threeDUrl = null;
  let gifUrl = null;

  let { animation_url, animation_original_url } = asset;
  animation_url = convertIpfsUrl(animation_url);
  animation_original_url = convertIpfsUrl(animation_original_url);
  const imageUrls = [
    convertIpfsUrl(asset.image_url),
    convertIpfsUrl(asset.image_original_url),
    convertIpfsUrl(asset.image_preview_url),
    convertIpfsUrl(asset.image_thumbnail_url),
  ];

  try {
    if (isAssetVideo(asset)) {
      mediaType = 'VIDEO';
      videoUrl = [animation_url, animation_original_url, ...imageUrls].find(
        url => !!url
      )! ?? null;
      const res = await fetch(videoUrl, { method: 'HEAD', mode: 'no-cors' });
      const isVideo = res.headers.get('Content-Type')?.includes('video');
      const isGif = res.headers.get('Content-Type')?.includes('gif');
      const isAudio = res.headers.get('Content-Type')?.includes('audio');
      const isHtml = res.headers.get('Content-Type')?.includes('html');
      if (isVideo) {
        mediaType = 'VIDEO';
      } else if (isGif) {
        mediaType = 'GIF';
      } else if (isAudio) {
        mediaType = 'AUDIO';
      } else if (isHtml || videoUrl.endsWith('html') || videoUrl.endsWith('htm')) {
        mediaType = 'HTML';
      }
      imageUrl = imageUrls.find(url => !!url)! ?? null;
    }  else if (isAssetThreeDAndIncludesImage(asset)) {
      mediaType = 'THREE_D';
      threeDUrl = [animation_url, animation_original_url, ...imageUrls].find(
        url => url && SUPPORTED_3D_EXTENSIONS.some(ext => url.endsWith(ext)),
      )! ?? null;
      frameUrl = imageUrls.find(
        url => url && NON_IMAGE_EXTENSIONS.every(ext => !url.endsWith(ext)),
      )! ?? null;
      if (frameUrl && frameUrl.startsWith("http")) {
        const res = await fetch(frameUrl, { method: 'HEAD', mode: 'no-cors' });
        const isGif = res.headers.get('Content-Type')?.includes('gif');
        if (isGif) {
          mediaType = 'GIF';
          gifUrl = frameUrl;
          frameUrl = null;
        }
      }
    } else if (isAssetGif(asset)) {
      mediaType = 'GIF';
      frameUrl = null;
      gifUrl = imageUrls.find(url => url?.endsWith('.gif'))! ?? null;
    } else {
      mediaType = 'IMAGE';
      frameUrl = imageUrls.find(url => !!url)! ?? null;
      if (frameUrl && frameUrl.startsWith("http")) {
        try {
          const res = await fetch(frameUrl, { method: 'HEAD', mode: 'no-cors' });
          const isGif = res.headers.get('Content-Type')?.includes('gif');
          const isVideo = res.headers.get('Content-Type')?.includes('video');
          const isImageOrSvg = res.headers.get('Content-Type')?.includes('image/svg+xml');
          if (isGif) {
            mediaType = 'GIF';
            gifUrl = frameUrl;
            frameUrl = null;
          } else if (isVideo) {
            mediaType = 'VIDEO';
            frameUrl = null;
            videoUrl = imageUrls.find(url => !!url)! ?? null;
          } else if (isImageOrSvg) {
            imageUrl = imageUrls.find(url => !!url)! ?? null;
          } else {
            imageUrl = await getGucUrl(frameUrl ?? "");
          }
        } catch (e) {
          imageUrl = await getGucUrl(frameUrl ?? "");
        }
      }
    }
  } catch (e) {
    console.error('Error processing collectible', e);
    mediaType = 'IMAGE';
    frameUrl = imageUrls.find(url => !!url)! ?? null;
    imageUrl = frameUrl;
  }

  return {
    openseaId: null,
    tokenId: asset.token_id,
    name: asset.name,
    description: asset.description,
    mediaType,
    frameUrl,
    imageUrl,
    videoUrl,
    threeDUrl,
    gifUrl,
    isOwned: true,
    dateCreated: null,
    dateLastTransferred: null,
    externalLink: null,
    permaLink: null,
    assetContractAddress: asset.contract_address ?? null,
    chain: 'eth',
    owner: asset.owner,
    wallet: asset.wallet,
    collection: asset.collection,
    status: AssetStatus.New,
  };
};

export const creationEventToCollectible = async (
  event: OpenSeaEventExtended,
): Promise<Collectible> => {
  const { asset, created_date } = event;

  const collectible = await assetToCollectible(asset);

  return {
    ...collectible,
    dateCreated: created_date,
    isOwned: false,
  };
};

export const transferEventToCollectible = async (
  event: OpenSeaEventExtended,
  isOwned = true,
): Promise<Collectible> => {
  const { asset, created_date } = event;

  const collectible = await assetToCollectible(asset);

  return {
    ...collectible,
    isOwned,
    dateLastTransferred: created_date,
  };
};

export const isFromNullAddress = (event: OpenSeaEvent) => {
  return event.from_account.address === NULL_ADDRESS;
};
