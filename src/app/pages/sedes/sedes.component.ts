import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-sedes',
  templateUrl: './sedes.component.html',
  styleUrls: ['./sedes.component.css']
})
export class SedesComponent implements OnInit {
  usuarioNombre: string = 'Usuario';
  usuarioRol: string = '';
  sidebarAbierto: boolean = false;

  constructor(private router: Router) {
    this.obtenerUsuario();
    window.addEventListener('storage', () => this.obtenerUsuario());
  }

  ngOnInit(): void {
    setTimeout(() => this.obtenerUsuario(), 300);
  }

  obtenerUsuario(): void {
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    if (usuario.nombre) this.usuarioNombre = usuario.nombre;
    if (usuario.rol) this.usuarioRol = usuario.rol;

    console.log('👤 Usuario cargado:', usuario);
  }

  toggleSidebar(): void {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    sidebar?.classList.toggle('active');
    overlay?.classList.toggle('active');
  }

  esAdmin(): boolean {
    return this.usuarioRol === 'Administrador' || this.usuarioRol === 'Dios';
  }

  cerrarSesion(): void {
    localStorage.clear();
    this.router.navigate(['/login']);
  }
}
