export const teachingLabel = (value?: string) => value
  ? value.replace(/_/g, ' ').toLowerCase().replace(/^\w/, character => character.toUpperCase())
  : 'Not provided';
