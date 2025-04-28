import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CalendarioTrabajadorComponent } from './calendario-trabajador.component';

describe('CalendarioTrabajadorComponent', () => {
  let component: CalendarioTrabajadorComponent;
  let fixture: ComponentFixture<CalendarioTrabajadorComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [CalendarioTrabajadorComponent]
    });
    fixture = TestBed.createComponent(CalendarioTrabajadorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
