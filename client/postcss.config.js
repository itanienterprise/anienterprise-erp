import postcssPresetEnv from 'postcss-preset-env';

const flattenLayers = () => {
  return {
    postcssPlugin: 'flatten-layers',
    Once(root) {
      root.walkAtRules('layer', (atRule) => {
        atRule.replaceWith(atRule.nodes);
      });
    },
  };
};
flattenLayers.postcss = true;

export default {
  plugins: [
    postcssPresetEnv({
      stage: 1,
      features: {
        'custom-properties': {
          preserve: true,
        },
        'cascade-layers': false, // Disable cascade layers transpilation (avoid :not(#\#) specificity hacks)
      },
      browsers: 'defaults, not IE 11, chrome 30, safari 7, ios 7, bb 10',
    }),
    flattenLayers(),
  ],
};
