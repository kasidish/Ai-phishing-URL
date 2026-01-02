const tf = require("@tensorflow/tfjs");
const fs = require("fs");
const extract = require("../ml/extractFeatures");

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
      throw new Error("Model files not found. Please run: node ml/train.js");
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
    console.log("Model loaded successfully");
  } catch (error) {
    console.error("Error loading model:", error.message);
    if (error.message.includes("not found")) {
      console.error("Please run: node ml/train.js");
    }
  } finally {
    modelLoading = false;
  }
};

loadModel();

module.exports = async function analyze(url) {
  await loadModel();
  
  if (!model || !modelReady) {
    throw new Error("Model failed to load. Please check the error messages above.");
  }
  
  const features = extract(url);
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
    features
  };
};
