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
import { formatCurrency } from "@/lib/utils";

interface ShareCampaignPartialProps {
  campanha: {
    nome: string;
    data_inicio: string;
    data_fim: string;
    tipo_meta: 'quantidade' | 'valor';
  };
  dadosParciais: {
    totalRealizado: number;
    metaTotal: number;
    percentual: number;
    lojas: Array<{
      numero: string;
      nome: string;
      realizado: number;
      meta: number;
      percentual: number;
    }>;
  };
}

export function ShareCampaignPartial({ campanha, dadosParciais }: ShareCampaignPartialProps) {
  const shareRef = useRef<HTMLDivElement>(null);
  const [headerImage, setHeaderImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const generateImage = async () => {
    if (!shareRef.current) return;

    try {
      const canvas = await html2canvas(shareRef.current, {
        backgroundColor: '#ffffff',
        scale: 3, // Alta definição
        useCORS: true,
        allowTaint: true,
        width: shareRef.current.scrollWidth,
        height: shareRef.current.scrollHeight,
      });

      return canvas.toDataURL('image/png');
    } catch (error) {
      console.error('Erro ao gerar imagem:', error);
      return null;
    }
  };

  const handleShare = async () => {
    try {
      const imageData = await generateImage();
      if (!imageData) return;

      const response = await fetch(imageData);
      const blob = await response.blob();
      
      if (navigator.share && navigator.canShare) {
        const file = new File([blob], 'parcial-campanha.png', { type: 'image/png' });
        
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: 'Parcial de Campanha',
            text: `Parcial da ${campanha.nome}`,
            files: [file]
          });
          toast.success('Imagem compartilhada com sucesso!');
        } else {
          await navigator.share({
            title: 'Parcial de Campanha',
            text: `Parcial da ${campanha.nome}`
          });
          downloadImage(imageData);
        }
      } else {
        downloadImage(imageData);
      }
    } catch (error) {
      console.error('Erro ao compartilhar:', error);
      toast.error('Erro ao compartilhar a imagem');
    }
  };

  const downloadImage = (imageData: string) => {
    const link = document.createElement('a');
    link.download = `parcial-campanha-${format(new Date(), 'dd-MM-yyyy')}.png`;
    link.href = imageData;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Imagem baixada com sucesso!');
  };

  const topLojas = [...dadosParciais.lojas]
    .sort((a, b) => b.percentual - a.percentual)
    .slice(0, 10);

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

      {/* Elemento invisível que será capturado - Mobile First (1080x1920) */}
      <div 
        ref={shareRef} 
        className="fixed -top-[99999px] left-0 bg-background"
        style={{ 
          width: '1080px',
          fontFamily: 'Inter, system-ui, sans-serif'
        }}
      >
        {/* Cabeçalho da campanha */}
        {headerImage && (
          <div className="w-full">
            <img src={headerImage} alt="Cabeçalho" className="w-full h-auto" />
          </div>
        )}

        {/* Conteúdo */}
        <div className="p-12 space-y-8">
          {/* Data da parcial */}
          <div className="text-center space-y-2">
            <h2 className="text-4xl font-bold text-foreground">PARCIAL DE VENDAS</h2>
            <p className="text-2xl text-muted-foreground">
              {format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          </div>

          {/* Card principal com totais */}
          <div className="bg-primary rounded-3xl p-10 text-primary-foreground space-y-6">
            <div className="text-center space-y-4">
              <p className="text-2xl font-semibold opacity-90">Total Realizado</p>
              <p className="text-7xl font-bold">
                {campanha.tipo_meta === 'valor' 
                  ? formatCurrency(dadosParciais.totalRealizado)
                  : dadosParciais.totalRealizado.toLocaleString('pt-BR')}
              </p>
            </div>

            <div className="h-6 bg-primary-foreground/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary-foreground rounded-full transition-all"
                style={{ width: `${Math.min(dadosParciais.percentual, 100)}%` }}
              />
            </div>

            <div className="flex justify-between items-center text-xl">
              <span className="opacity-90">Meta:</span>
              <span className="font-semibold">
                {campanha.tipo_meta === 'valor' 
                  ? formatCurrency(dadosParciais.metaTotal)
                  : dadosParciais.metaTotal.toLocaleString('pt-BR')}
              </span>
            </div>

            <div className="text-center pt-4">
              <p className="text-8xl font-black">
                {dadosParciais.percentual.toFixed(1)}%
              </p>
              <p className="text-2xl mt-2 opacity-90">da meta atingida</p>
            </div>
          </div>

          {/* Top 10 Lojas */}
          <div className="space-y-6">
            <h3 className="text-3xl font-bold text-center text-foreground">TOP 10 LOJAS</h3>
            <div className="space-y-3">
              {topLojas.map((loja, index) => (
                <div 
                  key={loja.numero}
                  className="bg-card rounded-2xl p-6 border-2 flex items-center gap-6"
                >
                  <div className={`
                    flex-shrink-0 w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold
                    ${index === 0 ? 'bg-yellow-500 text-yellow-900' : ''}
                    ${index === 1 ? 'bg-gray-400 text-gray-900' : ''}
                    ${index === 2 ? 'bg-orange-600 text-orange-100' : ''}
                    ${index > 2 ? 'bg-muted text-muted-foreground' : ''}
                  `}>
                    {index + 1}º
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-xl font-semibold text-foreground truncate">
                      Loja {loja.numero}
                    </p>
                    <p className="text-lg text-muted-foreground truncate">{loja.nome}</p>
                  </div>

                  <div className="text-right">
                    <p className="text-2xl font-bold text-foreground">
                      {campanha.tipo_meta === 'valor' 
                        ? formatCurrency(loja.realizado)
                        : loja.realizado.toLocaleString('pt-BR')}
                    </p>
                    <p className="text-lg text-primary font-semibold">
                      {loja.percentual.toFixed(1)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="text-center text-xl text-muted-foreground border-t pt-6">
            Gerado em {format(new Date(), 'dd/MM/yyyy HH:mm')}
          </div>
        </div>
      </div>

      {/* Botões de ação */}
      <div className="flex gap-2">
        <Button 
          onClick={handleShare}
          className="flex-1 sm:flex-none"
          disabled={!headerImage}
        >
          <Share2 className="w-4 h-4 mr-2" />
          Compartilhar Parcial
        </Button>
        <Button 
          onClick={async () => {
            const imageData = await generateImage();
            if (imageData) downloadImage(imageData);
          }}
          variant="outline"
          disabled={!headerImage}
        >
          <Download className="w-4 h-4 mr-2" />
          Baixar
        </Button>
      </div>

      {!headerImage && (
        <p className="text-sm text-muted-foreground text-center">
          Faça upload de um cabeçalho para gerar a parcial
        </p>
      )}
    </div>
  );
}
