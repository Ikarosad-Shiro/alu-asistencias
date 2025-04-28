import { TestBed } from '@angular/core/testing';

import { CalendarioTrabajadorService } from './calendario-trabajador.service';

describe('CalendarioTrabajadorService', () => {
  let service: CalendarioTrabajadorService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CalendarioTrabajadorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
