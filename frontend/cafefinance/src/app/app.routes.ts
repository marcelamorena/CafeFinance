import { Routes } from '@angular/router';
import { Cadastro } from './components/cadastro/cadastro';
import { Home } from './components/home/home';
import { Login } from './components/login/login';
import { Perfil } from './components/perfil/perfil';

export const routes: Routes = [
  { path: '', component: Login },
  { path: 'cadastro', component: Cadastro },
  { path: 'perfil', component: Perfil },
  { path: 'home', component: Home },
  { path: '**', redirectTo: '' },
];
