# generic

This is a generic service that can be automatically created and deployed by CI/CD pipelines

The configuration is declared inside `package.json` and it uses the `boot` method from a generic service library

```typescript
import { boot } from "@rotorsoft/eventually-service-expg";
void boot();
```
