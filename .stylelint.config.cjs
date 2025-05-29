// .stylelint.config.cjs
module.exports = {
  extends: ['stylelint-config-standard'],
  rules: {
    'at-rule-no-unknown': [
      true,
      {
        ignoreAtRules: [
          'tailwind',
          'apply',
          'layer',
          'responsive',
          'variants',
          'screen'
        ]
      }
    ]
  }
};
