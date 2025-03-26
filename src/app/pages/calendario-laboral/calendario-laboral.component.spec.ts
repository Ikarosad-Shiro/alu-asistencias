import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CalendarioLaboralComponent } from './calendario-laboral.component';

describe('CalendarioLaboralComponent', () => {
  let component: CalendarioLaboralComponent;
  let fixture: ComponentFixture<CalendarioLaboralComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [CalendarioLaboralComponent]
    });
    fixture = TestBed.createComponent(CalendarioLaboralComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
