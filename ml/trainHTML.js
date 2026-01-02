const tf = require("@tensorflow/tfjs");
const fs = require("fs");
const csv = require("csv-parser");
const extractHTML = require("./extractHTMLFeatures");
const fetchHTML = require("../utils/fetchHTML");

let X = [];
let y = [];
let processedCount = 0;
let errorCount = 0;
let successCount = 0;

/**
 * Reads URLs and labels from CSV files, fetches HTML, and extracts features.
 */
async function processDataset() {
  console.log("Starting dataset processing...\n");

  // Read phishing URL data
  const phishingUrls = [];
  const safeUrls = [];

  // Read phishing URLs from verified_online.csv
  console.log("Reading phishing URL data...");
  await new Promise((resolve, reject) => {
    fs.createReadStream("verified_online.csv")
      .pipe(csv())
      .on("data", row => {
        if (row.url && row.verified === 'yes' && row.online === 'yes') {
          phishingUrls.push(row.url);
        }
      })
      .on("end", () => {
        console.log(`Found ${phishingUrls.length} phishing URLs\n`);
        resolve();
      })
      .on("error", reject);
  });

  // Read safe URL data (from existing url.csv)
  console.log("Reading safe URL data...");
  await new Promise((resolve, reject) => {
    fs.createReadStream("data/url.csv")
      .pipe(csv())
      .on("data", row => {
        if (row.url && row.label === '0') {
          safeUrls.push(row.url);
        }
      })
      .on("end", () => {
        console.log(`Found ${safeUrls.length} safe URLs\n`);
        resolve();
      })
      .on("error", reject);
  });

  // Sampling (for sufficient training data)
  const MAX_PHISHING = 200; // Maximum number of phishing URLs
  const MAX_SAFE = 100; // Maximum number of safe URLs

  const sampledPhishing = phishingUrls.slice(0, MAX_PHISHING);
  const sampledSafe = safeUrls.slice(0, MAX_SAFE);

  console.log(`Starting HTML fetching (Phishing: ${sampledPhishing.length}, Safe: ${sampledSafe.length})...\n`);

  // Process phishing URLs
  for (let i = 0; i < sampledPhishing.length; i++) {
    const url = sampledPhishing[i];
    try {
      process.stdout.write(`\r   Processing phishing URL... ${i + 1}/${sampledPhishing.length} (Errors: ${errorCount})`);
      const html = await fetchHTML(url, 20000); // 20 second timeout
      
      // Print HTML structure for first URL only
      if (i === 0) {
        console.log(`\n\nFirst phishing URL HTML structure (${url}):`);
        console.log("=".repeat(80));
        console.log(html.substring(0, 2000)); // Print first 2000 characters only
        console.log("=".repeat(80));
        console.log(`\nTotal HTML length: ${html.length} characters\n`);
      }
      
      const features = extractHTML(html);
      X.push(features);
      y.push(1); // Phishing = 1
      processedCount++;
      successCount++;
      
      // Short delay (to prevent server overload)
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`\nError (${url}): ${error.message}`);
      errorCount++;
      // Add default features (all zeros) even on error
      X.push(new Array(15).fill(0));
      y.push(1);
    }
  }

  console.log(`\n  Phishing URL processing complete`);
  console.log(`   Success: ${successCount}, Failed: ${errorCount}\n`);

  // Process safe URLs
  for (let i = 0; i < sampledSafe.length; i++) {
    const url = sampledSafe[i];
    try {
      process.stdout.write(`\r   Processing safe URL... ${i + 1}/${sampledSafe.length} (Errors: ${errorCount})`);
      const html = await fetchHTML(url, 20000);
      
      // Print HTML structure for first URL only
      if (i === 0) {
        console.log(`\n\nFirst safe URL HTML structure (${url}):`);
        console.log("=".repeat(80));
        console.log(html.substring(0, 2000)); // Print first 2000 characters only
        console.log("=".repeat(80));
        console.log(`\nTotal HTML length: ${html.length} characters\n`);
      }
      
      const features = extractHTML(html);
      X.push(features);
      y.push(0); // Safe = 0
      processedCount++;
      successCount++;
      
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`\nError (${url}): ${error.message}`);
      errorCount++;
      X.push(new Array(15).fill(0));
      y.push(0);
    }
  }

  console.log(`\n   Safe URL processing complete`);
  console.log(`   Success: ${successCount}, Failed: ${errorCount}\n`);
  console.log(` Total processed: ${processedCount} (Success: ${successCount}, Failed: ${errorCount})\n`);
}

/**
 * Train the model
 */
async function trainModel() {
  if (X.length === 0) {
    throw new Error("Dataset is empty!");
  }

  console.log(`   Training data: ${X.length} samples`);
  console.log(`   Safe URLs: ${y.filter(l => l === 0).length}`);
  console.log(`   Phishing URLs: ${y.filter(l => l === 1).length}\n`);

  const xs = tf.tensor2d(X);
  const ys = tf.tensor2d(y, [y.length, 1]);

  // Model architecture (15 input features)
  const model = tf.sequential();
  model.add(tf.layers.dense({
    inputShape: [15],
    units: 64,
    activation: "relu"
  }));
  model.add(tf.layers.dropout({ rate: 0.3 }));
  model.add(tf.layers.dense({ units: 32, activation: "relu" }));
  model.add(tf.layers.dropout({ rate: 0.2 }));
  model.add(tf.layers.dense({ units: 1, activation: "sigmoid" }));

  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: "binaryCrossentropy",
    metrics: ["accuracy"]
  });

  console.log("Starting model training...\n");
  await model.fit(xs, ys, {
    epochs: 100,
    batchSize: Math.min(32, X.length),
    validationSplit: 0.1, // Reduced validation split due to limited data
    verbose: 0,
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        if ((epoch + 1) % 20 === 0 || epoch === 0) {
          console.log(
            `   Epoch ${epoch + 1}/100 - Loss: ${logs.loss.toFixed(4)}, Accuracy: ${(logs.acc * 100).toFixed(1)}%, Val Loss: ${logs.val_loss?.toFixed(4) || 'N/A'}, Val Acc: ${(logs.val_acc * 100).toFixed(1) || 'N/A'}%`
          );
        }
      }
    }
  });

  // Test
  console.log("\nTesting on training data:");
  const predictions = model.predict(xs);
  const predData = await predictions.data();
  for (let i = 0; i < Math.min(5, X.length); i++) {
    const actual = y[i];
    const predicted = predData[i];
    const riskScore = Math.round(predicted * 100);
    console.log(`   Sample ${i + 1}: Actual=${actual}, Predicted=${riskScore}% (${predicted.toFixed(3)})`);
  }
  predictions.dispose();

  // Save model
  const modelDir = "ml/model";
  if (!fs.existsSync(modelDir)) {
    fs.mkdirSync(modelDir, { recursive: true });
  }

  const modelJson = model.toJSON();
  fs.writeFileSync(
    `${modelDir}/model.json`,
    JSON.stringify(modelJson)
  );

  const weights = await model.getWeights();
  const weightData = weights.map(w => ({
    shape: w.shape,
    data: Array.from(w.dataSync())
  }));

  fs.writeFileSync(
    `${modelDir}/weights.json`,
    JSON.stringify(weightData, null, 2)
  );

  xs.dispose();
  ys.dispose();

  console.log("\nModel training complete and saved to ml/model/");
}

// Main execution
(async () => {
  try {
    await processDataset();
    await trainModel();
  } catch (error) {
    console.error("\nError:", error.message);
    process.exit(1);
  }
})();

