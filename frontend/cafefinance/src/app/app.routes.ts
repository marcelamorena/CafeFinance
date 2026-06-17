import { Routes } from '@angular/router';
import { Cadastro } from './components/cadastro/cadastro';
import { Economias } from './components/economias/economias';
import { Home } from './components/home/home';
import { Login } from './components/login/login';
import { Perfil } from './components/perfil/perfil';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', component: Login },
  { path: 'cadastro', component: Cadastro },
  { path: 'perfil', component: Perfil, canActivate: [authGuard] },
  { path: 'home', component: Home, canActivate: [authGuard] },
  { path: 'economias', component: Economias, canActivate: [authGuard] },
  { path: '**', redirectTo: '' },
];
