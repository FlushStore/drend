import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Casca } from "./casca/Casca";
import { StoreProvider } from "./store";
import { Drend } from "./telas/Drend";
import { Hoje } from "./telas/Hoje";
import { Missoes } from "./telas/Missoes";
import { Mural } from "./telas/Mural";
import { Negocios } from "./telas/Negocios";
import { Vida } from "./telas/Vida";

export default function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Casca />}>
            <Route index element={<Hoje />} />
            <Route path="negocios" element={<Negocios />} />
            <Route path="missoes" element={<Missoes />} />
            <Route path="mural" element={<Mural />} />
            <Route path="vida" element={<Vida />} />
            <Route path="drend" element={<Drend />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </StoreProvider>
  );
}
