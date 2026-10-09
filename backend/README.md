# Tattoo reference images

Tattoo inspiration images are loaded from `C:\Users\Vikheyath R Bangera\Desktop\Reserch paper dataset\Tattoo_img_200`; labels are read from `C:\Users\Vikheyath R Bangera\Desktop\Reserch paper dataset\tattoo_200_image.csv`. The CSV must contain `image_name`, `complexity`, and `color` columns, with image names matching files in the image folder. The app displays six random labeled images when requested. Selecting one applies its complexity and color to the price-estimate inputs.

The image collection is a visual reference dataset, not training data for the price model. The price model is trained only on the price dataset below. The app does not generate images or fetch image-search results from third-party services. Set `TATTOO_IMAGE_DATASET` and `TATTOO_IMAGE_METADATA` to override the image folder and metadata CSV.

## Price prediction model

Price predictions use the dataset at `C:\Users\Vikheyath R Bangera\Desktop\Reserch paper dataset\tattoo_price_training_india_100k_clean.csv` and are available for Indian cities only. The model is trained from that dataset and estimates are based on the available pricing records rather than guaranteed studio quotes. Prices are displayed in INR.

To retrain after changing the training data, run `python ml/train.py` from the project root using the backend Python environment. The script evaluates a held-out split and writes `ml/saved_models/price_prediction_model.joblib`; restart the backend afterward to load the new model. The API converts size, placement, color, artist level, and design type into the model's training features.
