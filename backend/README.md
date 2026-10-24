# Tattoo reference images

Tattoo inspiration images are served from `ml/data/Tattoo_img_200`. Each image's complexity, color and minimum readable size come from the price dataset (via the trained model bundle), so no separate label CSV is needed. The app displays six random labeled images when requested. Selecting one applies its complexity and color to the price-estimate inputs, matches the size proportion to the image, and starts at the dataset's recommended size (minimum readable size plus 1 in on each side).

The image collection is a visual reference dataset. Image names are not a model feature; only their complexity and color labels affect the price. Set `TATTOO_IMAGE_DATASET` to override the image folder.

## Price prediction model

Price predictions use `ml/data/tattoo_price_dataset_india_image_location.csv` and are available for Indian locations only. Neither the CSV nor the image folder is committed to git; copy them into `ml/data/` before training.

To retrain, run these from the project root using the backend Python environment:

```
python ml/preprocessing/prepare_dataset.py
python ml/train.py
```

The model predicts min, mid and max per-square-inch rates in INR from the location (name, type, state, parent city), complexity and color. `ml/pricing.py` multiplies the rate by width x height, applies the location's minimum studio charge and rounds to ₹50. Sizes above the dataset's 5 x 5 in are scaled by area and flagged as `extrapolated`. Training prints held-out results for unseen locations and for size extrapolation and writes `ml/saved_models/price_model_v2.joblib` (plus a metrics JSON). Restart the backend afterward. Set `TATTOO_PRICE_MODEL` to load a different bundle.

`POST /api/price/predict` takes `city`, optional `state` and `location_type`, `width_in`, `height_in` (0.5 in steps), `complexity` (`Simple`/`Medium`/`Complex`), `color` (`Black_Gray`/`Colored`) and optional `placement`. Sizes are checked by the same rules as the frontend (`frontend/src/lib/tattoo-dimensions.ts`): minimum side by complexity, long side at most 3x the short side (4x for bands and spine pieces), and per-placement maximums. Invalid sizes return 422. `GET /api/locations` lists the dataset locations for the city picker.
