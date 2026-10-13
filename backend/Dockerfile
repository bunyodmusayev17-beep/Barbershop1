# NyBarber API — build: docker build -f backend/Dockerfile backend
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY NyBarber.Api/NyBarber.Api.csproj NyBarber.Api/
RUN dotnet restore NyBarber.Api/NyBarber.Api.csproj
COPY NyBarber.Api/ NyBarber.Api/
RUN dotnet publish NyBarber.Api/NyBarber.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0
# Npgsql Kerberos kutubxonasini qidiradi — bo'lmasa logda ogohlantirish chiqadi
RUN apt-get update && apt-get install -y --no-install-recommends libgssapi-krb5-2 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app .
# Yuklangan rasmlar host'dagi alohida papkaga bog'lanadi (docker-compose: ./uploads)
RUN mkdir -p wwwroot/uploads && chown -R app:app wwwroot
USER app
EXPOSE 8080
ENTRYPOINT ["dotnet", "NyBarber.Api.dll"]
