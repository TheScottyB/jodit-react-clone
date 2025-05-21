const webpack = require('webpack');
const path = require('path');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    entry: './src/index.ts',
    devtool: isProduction ? 'source-map' : 'eval-source-map',
    module: {
      rules: [
        {
          test: /\.(ts|tsx)$/,
          exclude: /node_modules/,
          use: [
            {
              loader: 'babel-loader',
              options: {
                presets: [
                  '@babel/preset-env',
                  '@babel/preset-react',
                  '@babel/preset-typescript'
                ]
              }
            }
          ]
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader']
        }
      ]
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
      alias: {
        'jodit-react': path.resolve(__dirname, 'src')
      }
    },
    output: {
      path: path.resolve(__dirname, 'build'),
      filename: 'jodit-react.js',
      library: {
        name: 'JoditEditor',
        type: 'umd',
        umdNamedDefine: true
      },
      clean: true
    },
    optimization: {
      minimize: isProduction,
      moduleIds: 'deterministic'
    },
    externals: {
      jodit: {
        root: 'Jodit',
        commonjs2: 'jodit',
        commonjs: 'jodit',
        amd: 'jodit'
      },
      react: {
        root: 'React',
        commonjs2: 'react',
        commonjs: 'react',
        amd: 'react'
      },
      'react-dom': {
        root: 'ReactDOM',
        commonjs2: 'react-dom',
        commonjs: 'react-dom',
        amd: 'react-dom'
      }
    },
    plugins: [
      new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development')
      })
    ]
  };
};
