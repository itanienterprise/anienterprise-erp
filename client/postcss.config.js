import postcssPresetEnv from 'postcss-preset-env';

export default {
  plugins: [
    postcssPresetEnv({
      stage: 1,
      features: {
        'custom-properties': {
          preserve: true,
        },
      },
      browsers: 'defaults, not IE 11, chrome 30, safari 7, ios 7, bb 10',
    }),
  ],
};
