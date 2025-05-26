import { TestBed } from '@angular/core/testing';

import { ProcesadorAsistenciasService } from './procesador-asistencias.service';

describe('ProcesadorAsistenciasService', () => {
  let service: ProcesadorAsistenciasService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ProcesadorAsistenciasService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
