const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  mode: process.env.NODE_ENV || 'development',
  entry: {
    main: './client/src/index.js',
    game: './client/src/game.js'
  },
  output: {
    path: path.resolve(__dirname, 'client/dist'),
    filename: '[name].[contenthash].js',
    clean: true,
    publicPath: '/'
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './client/src/index.html',
      filename: 'index.html',
      chunks: ['main']
    }),
    new HtmlWebpackPlugin({
      template: './client/src/game.html',
      filename: 'game.html',
      chunks: ['game']
    })
  ],
  devServer: {
    static: {
      directory: path.join(__dirname, 'client/dist'),
      publicPath: '/'
    },
    hot: true,
    liveReload: true,
    historyApiFallback: true,
    devMiddleware: {
      writeToDisk: true
    },
    proxy: [
      {
        context: ['/socket.io', '/api', '/game', '/play'],
        target: 'http://localhost:3000',
        ws: true
      }
    ]
  },
  watchOptions: {
    ignored: /node_modules/,
    poll: 1000
  }
}; 