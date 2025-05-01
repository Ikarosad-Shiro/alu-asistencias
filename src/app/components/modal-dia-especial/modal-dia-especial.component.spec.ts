import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModalDiaEspecialComponent } from './modal-dia-especial.component';

describe('ModalDiaEspecialComponent', () => {
  let component: ModalDiaEspecialComponent;
  let fixture: ComponentFixture<ModalDiaEspecialComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ModalDiaEspecialComponent]
    });
    fixture = TestBed.createComponent(ModalDiaEspecialComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
