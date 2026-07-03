import * as MapService from '../../services/map.service.js';

function mapField(field) {
  return {
    id: field._id.toString(),
    position: field.position,
    x: field.x,
    y: field.y,
    type: field.type,
    nextFields: field.nextFields || [],
    enemies: (field.enemies || []).map(e => ({
      id: e._id.toString(),
      name: e.name,
      type: e.type,
      baseHealth: e.base_health,
      baseDamage: e.base_damage,
    })),
  };
}

export const runResolvers = {
  Query: {
    getMap: async (_, __, context) => {
      if (!context.user){
        throw new Error('Nicht authentifiziert');
      }
      const map = await MapService.getMap();
      if (!map){
        throw new Error('Map nicht gefunden');
      }
      return {
        id: map._id.toString(),
        name: map.name,
        fields: map.fields.map(mapField),
      };
    },
  },
  Mutation: {},
};
