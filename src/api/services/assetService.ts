import { endpoints } from '../endpoints';
import { http } from '../httpClient';
import type { Asset } from '../../types/domain';

/** Assets are read from and saved to structx.sqlite by the API (GET / PUT /assets/{code}). There is no mock copy. */
export const assetService = {
  /** One asset, freshly read. */
  get(id: string): Promise<Asset> {
    return http.get<Asset>(endpoints.assets.byId(id));
  },

  /** Adds an empty asset to structx.sqlite (POST /assets). Its set-up and inputs are saved afterwards with update(). */
  create(code: string): Promise<Asset> {
    return http.post<Asset>(endpoints.assets.create, { code });
  },

  /** Saves the asset record, including its assessment workspace. */
  update(asset: Asset): Promise<Asset> {
    return http.put<Asset>(endpoints.assets.byId(asset.id), asset);
  }
};
