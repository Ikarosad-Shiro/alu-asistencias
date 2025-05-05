import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CalendarioUnificadoComponent } from './calendario-unificado.component';

describe('CalendarioUnificadoComponent', () => {
  let component: CalendarioUnificadoComponent;
  let fixture: ComponentFixture<CalendarioUnificadoComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [CalendarioUnificadoComponent]
    });
    fixture = TestBed.createComponent(CalendarioUnificadoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
