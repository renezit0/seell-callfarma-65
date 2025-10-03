import { Button } from "@/components/ui/button";
import { Share2, Download, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import html2canvas from "html2canvas";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";

interface ShareCampaignPartialProps {
  campanha: {
    nome: string;
    data_inicio: string;
    data_fim: string;
    tipo_meta: 'quantidade' | 'valor';
  };
  grupos: Array<{
    numeroGrupo: number;
    lojas: Array<{
      numero: string;
      nome: string;
      realizado: number;
      meta: number;
      percentual: number;
    }>;
  }>;
}

export function ShareCampaignPartial({ campanha, grupos }: ShareCampaignPartialProps) {
  const shareRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [headerImage, setHeaderImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [grupoSelecionado, setGrupoSelecionado] = useState<number>(1);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Imagem muito grande. Máximo 5MB.');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        setHeaderImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const generateImage = async (grupoIndex: number) => {
    const targetRef = shareRefs.current[grupoIndex];
    if (!targetRef) return;

    try {
      const canvas = await html2canvas(targetRef, {
        backgroundColor: '#ffffff',
        scale: 3,
        useCORS: true,
        allowTaint: true,
        width: targetRef.scrollWidth,
        height: targetRef.scrollHeight,
      });

      return canvas.toDataURL('image/png');
    } catch (error) {
      console.error('Erro ao gerar imagem:', error);
      return null;
    }
  };

  const handleShare = async (grupoIndex: number) => {
    try {
      const imageData = await generateImage(grupoIndex);
      if (!imageData) return;

      const response = await fetch(imageData);
      const blob = await response.blob();
      
      if (navigator.share && navigator.canShare) {
        const file = new File([blob], `parcial-grupo-${grupoIndex + 1}.png`, { type: 'image/png' });
        
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: `Parcial - Grupo ${grupoIndex + 1}`,
            text: `Parcial do Grupo ${grupoIndex + 1} - ${campanha.nome}`,
            files: [file]
          });
          toast.success('Imagem compartilhada com sucesso!');
        } else {
          await navigator.share({
            title: `Parcial - Grupo ${grupoIndex + 1}`,
            text: `Parcial do Grupo ${grupoIndex + 1} - ${campanha.nome}`
          });
          downloadImage(imageData, grupoIndex);
        }
      } else {
        downloadImage(imageData, grupoIndex);
      }
    } catch (error) {
      console.error('Erro ao compartilhar:', error);
      toast.error('Erro ao compartilhar a imagem');
    }
  };

  const downloadImage = (imageData: string, grupoIndex: number) => {
    const link = document.createElement('a');
    link.download = `parcial-grupo-${grupoIndex + 1}-${format(new Date(), 'dd-MM-yyyy')}.png`;
    link.href = imageData;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Imagem baixada com sucesso!');
  };

  const grupoAtual = grupos.find(g => g.numeroGrupo === grupoSelecionado);

  return (
    <div className="space-y-4">
      {/* Upload de Cabeçalho */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="header-upload" className="text-base font-semibold">
                Cabeçalho da Campanha
              </Label>
              <p className="text-sm text-muted-foreground mb-2">
                Faça upload de uma imagem para o cabeçalho (recomendado: 1080x400px)
              </p>
              <div className="flex gap-2">
                <Input
                  id="header-upload"
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="flex-1"
                />
                {headerImage && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      setHeaderImage(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {headerImage && (
              <div className="rounded-lg overflow-hidden border">
                <img src={headerImage} alt="Preview" className="w-full h-auto" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Seletor de Grupo */}
      <Card>
        <CardContent className="pt-6">
          <Label className="text-base font-semibold mb-2 block">Selecione o Grupo</Label>
          <div className="flex gap-2">
            {grupos.map((grupo) => (
              <Button
                key={grupo.numeroGrupo}
                variant={grupoSelecionado === grupo.numeroGrupo ? "default" : "outline"}
                onClick={() => setGrupoSelecionado(grupo.numeroGrupo)}
                className="flex-1"
              >
                Grupo {grupo.numeroGrupo}
                <Badge variant="secondary" className="ml-2">{grupo.lojas.length}</Badge>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Elementos invisíveis que serão capturados */}
      {grupos.map((grupo, grupoIndex) => {
        const totalRealizado = grupo.lojas.reduce((sum, loja) => sum + loja.realizado, 0);
        const totalMeta = grupo.lojas.reduce((sum, loja) => sum + loja.meta, 0);
        const percentual = totalMeta > 0 ? (totalRealizado / totalMeta) * 100 : 0;

        return (
          <div 
            key={grupo.numeroGrupo}
            ref={(el) => shareRefs.current[grupoIndex] = el}
            className="fixed -top-[99999px] left-0 bg-white"
            style={{ 
              width: '1080px',
              fontFamily: 'Inter, system-ui, sans-serif'
            }}
          >
            {/* Cabeçalho */}
            {headerImage && (
              <div className="w-full">
                <img src={headerImage} alt="Cabeçalho" className="w-full h-auto" />
              </div>
            )}

            {/* Conteúdo */}
            <div className="p-12 space-y-8">
              {/* Título */}
              <div className="text-center space-y-2">
                <h2 className="text-5xl font-bold text-gray-900">GRUPO {grupo.numeroGrupo}</h2>
                <p className="text-2xl text-gray-600">
                  {format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
              </div>

              {/* Card de totais do grupo */}
              <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-3xl p-10 text-white space-y-6 shadow-xl">
                <div className="text-center space-y-4">
                  <p className="text-2xl font-semibold opacity-90">Total do Grupo</p>
                  <p className="text-7xl font-bold">
                    {campanha.tipo_meta === 'valor' 
                      ? formatCurrency(totalRealizado)
                      : totalRealizado.toLocaleString('pt-BR')}
                  </p>
                </div>

                <div className="h-6 bg-white/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-white rounded-full transition-all"
                    style={{ width: `${Math.min(percentual, 100)}%` }}
                  />
                </div>

                <div className="flex justify-between items-center text-xl">
                  <span className="opacity-90">Meta do Grupo:</span>
                  <span className="font-semibold">
                    {campanha.tipo_meta === 'valor' 
                      ? formatCurrency(totalMeta)
                      : totalMeta.toLocaleString('pt-BR')}
                  </span>
                </div>

                <div className="text-center pt-4">
                  <p className="text-8xl font-black">
                    {percentual.toFixed(1)}%
                  </p>
                  <p className="text-2xl mt-2 opacity-90">da meta atingida</p>
                </div>
              </div>

              {/* Ranking de lojas */}
              <div className="space-y-4">
                <h3 className="text-3xl font-bold text-center text-gray-900">RANKING DAS LOJAS</h3>
                <div className="space-y-2">
                  {grupo.lojas
                    .sort((a, b) => b.percentual - a.percentual)
                    .map((loja, index) => (
                    <div 
                      key={loja.numero}
                      className="bg-gray-50 rounded-xl p-4 border-2 border-gray-200 flex items-center gap-4"
                    >
                      <div className={`
                        flex-shrink-0 w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold
                        ${index === 0 ? 'bg-yellow-400 text-yellow-900' : ''}
                        ${index === 1 ? 'bg-gray-300 text-gray-900' : ''}
                        ${index === 2 ? 'bg-orange-500 text-white' : ''}
                        ${index > 2 ? 'bg-gray-200 text-gray-700' : ''}
                      `}>
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}º`}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className="text-xl font-bold text-gray-900 truncate">
                          Loja {loja.numero}
                        </p>
                        <p className="text-base text-gray-600 truncate">{loja.nome}</p>
                      </div>

                      <div className="text-right">
                        <p className="text-2xl font-bold text-gray-900">
                          {campanha.tipo_meta === 'valor' 
                            ? formatCurrency(loja.realizado)
                            : loja.realizado.toLocaleString('pt-BR')}
                        </p>
                        <p className="text-lg text-blue-600 font-bold">
                          {loja.percentual.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="text-center text-lg text-gray-500 border-t border-gray-300 pt-6">
                Gerado em {format(new Date(), 'dd/MM/yyyy HH:mm')}
              </div>
            </div>
          </div>
        );
      })}

      {/* Botões de ação */}
      {grupoAtual && (
        <div className="flex gap-2">
          <Button 
            onClick={() => handleShare(grupoSelecionado - 1)}
            className="flex-1 sm:flex-none"
            disabled={!headerImage}
          >
            <Share2 className="w-4 h-4 mr-2" />
            Compartilhar Grupo {grupoSelecionado}
          </Button>
          <Button 
            onClick={async () => {
              const imageData = await generateImage(grupoSelecionado - 1);
              if (imageData) downloadImage(imageData, grupoSelecionado - 1);
            }}
            variant="outline"
            disabled={!headerImage}
          >
            <Download className="w-4 h-4 mr-2" />
            Baixar
          </Button>
        </div>
      )}

      {!headerImage && (
        <p className="text-sm text-muted-foreground text-center">
          Faça upload de um cabeçalho para gerar a parcial
        </p>
      )}
    </div>
  );
}
