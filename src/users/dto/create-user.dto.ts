//define que datos esperas. Si no llega JSON válido → body = undefined

export class CreateUserDto {
  username: string;
  email: string;
  password: string;
}
