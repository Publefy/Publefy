// export class Profile {
//     public id: string
//     public name: string
//     public platform: string
//     public image: string
//     public access_token: string

//     constructor() {
//         this.id = ""
//         this.name = ""
//         this.platform = ""
//         this.image = ""
//         this.access_token = ""
//     }
// } 
export class Profile {
  public id: string;
  public name: string;
  public username?: string;
  public platform: string;
  public image: string;
  public access_token?: string;
  public ig_id?: string;
  public fb_id?: string;

  constructor(init?: Partial<Profile>) {
    this.id = init?.id || "";
    this.name = init?.name || "";
    this.username = init?.username;
    this.platform = init?.platform || "";
    this.image = init?.image || "";
    this.access_token = init?.access_token;
    this.ig_id = init?.ig_id;
    this.fb_id = init?.fb_id;
  }
}

