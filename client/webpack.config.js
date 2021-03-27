const path = require('path');

module.exports = {
  entry: './src/index.js',
  output: {
    filename: 'client.js',
    path: path.resolve(__dirname, 'dist'),
  },
  mode: 'development'
};

// npx webpack --config webpack.config.js