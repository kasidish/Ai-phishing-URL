const tf = require("@tensorflow/tfjs");
const fs = require("fs");
const extractHTML = require("../ml/extractHTMLFeatures");
const fetchHTML = require("../utils/fetchHTML");

let model;
let modelLoading = false;
let modelReady = false;

const loadModel = async () => {
  if (modelReady) return;
  if (modelLoading) {
    while (modelLoading) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return;
  }
  
  modelLoading = true;
  try {
    const modelPath = "ml/model/model.json";
    const weightsPath = "ml/model/weights.json";
    
    if (!fs.existsSync(modelPath) || !fs.existsSync(weightsPath)) {
      throw new Error("Model files not found. Please run: node ml/trainHTML.js");
    }
    
    let modelJsonStr = fs.readFileSync(modelPath, "utf8");
    if (modelJsonStr.startsWith('"')) {
      modelJsonStr = JSON.parse(modelJsonStr);
    }
    const modelJson = JSON.parse(modelJsonStr);
    
    model = tf.sequential();
    
    const layerMap = {
      'Dense': tf.layers.dense,
      'Conv2D': tf.layers.conv2d,
      'LSTM': tf.layers.lstm,
      'Flatten': tf.layers.flatten,
      'Dropout': tf.layers.dropout
    };
    
    for (let i = 0; i < modelJson.config.layers.length; i++) {
      const layerConfig = modelJson.config.layers[i];
      const LayerFactory = layerMap[layerConfig.class_name];
      if (!LayerFactory) {
        throw new Error(`Unknown layer type: ${layerConfig.class_name}`);
      }
      
      const config = { ...layerConfig.config };
      if (i === 0 && config.batch_input_shape) {
        config.inputShape = config.batch_input_shape.slice(1);
        delete config.batch_input_shape;
      }
      
      const layer = LayerFactory(config);
      model.add(layer);
    }
    
    model.compile({
      optimizer: "adam",
      loss: "binaryCrossentropy",
      metrics: ["accuracy"]
    });
    
    const weightsData = JSON.parse(fs.readFileSync(weightsPath, "utf8"));
    const weights = weightsData.map(w => tf.tensor(w.data, w.shape));
    model.setWeights(weights);
    
    modelReady = true;
    console.log("HTML-based model loaded successfully");
  } catch (error) {
    console.error("Model loading error:", error.message);
    if (error.message.includes("not found")) {
      console.error("Please run: node ml/trainHTML.js");
    }
  } finally {
    modelLoading = false;
  }
};

loadModel();

/**
 * Analyzes URL. Fetches HTML, extracts features, and predicts using the model.
 * @param {string} url - URL to analyze
 * @returns {Promise<Object>} Analysis result
 */
module.exports = async function analyze(url) {
  await loadModel();
  
  if (!model || !modelReady) {
    throw new Error("Model loading failed. Please check the error messages above.");
  }

  try {
    // Fetch HTML
    console.log(`Fetching HTML: ${url}`);
    const html = await fetchHTML(url, 30000);
    
    // Extract features from HTML
    const features = extractHTML(html);
    
    // Predict using model
    const input = tf.tensor2d([features]);
    const prediction = model.predict(input);
    const score = (await prediction.data())[0];
    
    input.dispose();
    prediction.dispose();

    const riskScore = Math.round(score * 100);
    let decision =
      riskScore >= 70 ? "BLOCK" :
      riskScore >= 40 ? "WARN"  :
                        "ALLOW";

    return {
      url,
      riskScore,
      decision,
      features,
      htmlLength: html.length
    };
  } catch (error) {
    throw new Error(`URL analysis failed: ${error.message}`);
  }
};

