import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

export interface CadastroRequest {
    name: string;
    email: string;
    password: string;
    confirmarSenha: string;
}

export interface CadastroResponse {
    success: boolean;
    message: string;
    user?: {
        id: number;
        name: string;
        email: string;
    };
}

//Login interface

//envia para o back
export interface LoginRequest{
    email: String;
    senha: String;
}

//recebe do back
export interface LoginResponse{
    success: boolean;
    message: string;
    user?: {
        id: number;
        name: string;
        email: string;
    }
}



@Injectable({
    providedIn: 'root',
})
export class AuthService {
    private readonly http = inject(HttpClient);
    private readonly apiUrl = 'http://localhost/api/php';

    registrar(dados: CadastroRequest) {
    return this.http.post<CadastroResponse>(`${this.apiUrl}/cadastro`, dados);
    }

    login(dados: LoginRequest){
        return this.http.post<LoginResponse>(`${this.apiUrl}/login`,dados);
    }

}
