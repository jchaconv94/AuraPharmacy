import { describe, expect, it } from 'vitest';
import { filterFacilitiesByJurisdiction, getUserJurisdictionScope } from './jurisdictionService';
import { HealthFacility, User } from '../types';

const mockFacilities: HealthFacility[] = [
  { code: '06503', name: 'P.S. Buenos Aires', category: 'I-3', ungetId: 'UNGET_BELLAVISTA', ogessId: 'OGESS_HUALLAGA_CENTRAL', microredId: 'MR_BUENOS_AIRES' },
  { code: '06504', name: 'CS Bellavista', category: 'I-4', ungetId: 'UNGET_BELLAVISTA', ogessId: 'OGESS_HUALLAGA_CENTRAL', microredId: 'MR_BELLAVISTA' },
  { code: '07001', name: 'Hospital Tarapoto', category: 'II-2', ungetId: 'UNGET_SAN_MARTIN', ogessId: 'OGESS_BAJO_MAYO', microredId: 'MR_TARAPOTO' },
  { code: '07002', name: 'CS Morales', category: 'I-4', ungetId: 'UNGET_SAN_MARTIN', ogessId: 'OGESS_BAJO_MAYO', microredId: 'MR_MORALES' },
];

describe('jurisdictionService', () => {
  it('identifica correctamente el nivel GLOBAL para ADMIN o Informático DIRESA', () => {
    const adminUser: User = { username: 'admin', role: 'ADMIN', personnelId: 'p1', isActive: true, permissions: [] };
    const diresaUser: User = { username: 'diresa', role: 'INFORMATICO_DIRESA', personnelId: 'p2', isActive: true, permissions: [] };

    expect(getUserJurisdictionScope(adminUser).level).toBe('GLOBAL');
    expect(getUserJurisdictionScope(diresaUser).level).toBe('GLOBAL');
    expect(filterFacilitiesByJurisdiction(mockFacilities, adminUser)).toHaveLength(4);
  });

  it('filtra por OGESS para Informático de OGESS', () => {
    const ogessUser: User = {
      username: 'ogess_user',
      role: 'INFORMATICO_OGESS',
      personnelId: 'p3',
      isActive: true,
      permissions: [],
      personnelData: { id: 'p3', firstName: 'Juan', lastName: 'Perez', dni: '123', ogessId: 'OGESS_HUALLAGA_CENTRAL' }
    };

    const scope = getUserJurisdictionScope(ogessUser);
    expect(scope.level).toBe('OGESS');

    const filtered = filterFacilitiesByJurisdiction(mockFacilities, ogessUser);
    expect(filtered).toHaveLength(2);
    expect(filtered.every(f => f.ogessId === 'OGESS_HUALLAGA_CENTRAL')).toBe(true);
  });

  it('filtra por RED/UNGET para Informático SISMED de Red/UNGET', () => {
    const redUser: User = {
      username: 'red_bellavista',
      role: 'INFORMATICO_RED',
      personnelId: 'p4',
      isActive: true,
      permissions: [],
      personnelData: { id: 'p4', firstName: 'Pedro', lastName: 'Gomez', dni: '456', ungetId: 'UNGET_BELLAVISTA' }
    };

    const scope = getUserJurisdictionScope(redUser);
    expect(scope.level).toBe('UNGET');

    const filtered = filterFacilitiesByJurisdiction(mockFacilities, redUser);
    expect(filtered).toHaveLength(2);
    expect(filtered.map(f => f.code)).toEqual(['06503', '06504']);
  });

  it('restringe únicamente a su propia IPRESS para un Responsable de Farmacia', () => {
    const farmaciaUser: User = {
      username: 'german',
      role: 'FARMACIA',
      personnelId: 'p5',
      isActive: true,
      permissions: [],
      facilityData: { code: '06503', name: 'P.S. Buenos Aires', category: 'I-3', ungetId: 'UNGET_BELLAVISTA' }
    };

    const scope = getUserJurisdictionScope(farmaciaUser);
    expect(scope.level).toBe('IPRESS');
    expect(scope.isInformaticoOrSupervisor).toBe(false);

    const filtered = filterFacilitiesByJurisdiction(mockFacilities, farmaciaUser);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].code).toBe('06503');
  });
});
